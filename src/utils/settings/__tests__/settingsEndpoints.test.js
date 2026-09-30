// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { randomBytes } from "node:crypto";
import { POST as whatsapp } from "../../../../api/whatsapp.js";
import { POST as storeApi } from "../../../../api/store.js";
import { saveTokens } from "../../../../api/_lib/merchantTokens.js";
import { open, seal } from "../../../../api/_lib/secretBox.js";
import { fakeRedis } from "../../../test/fakeRedis.js";

const KV_URL = "https://kv.example.upstash.io";
const WABA = "1478536534308215";
const PHONE_ID = "1324055010792496";

const META_TEMPLATES = [
  {
    id: "111",
    name: "cart_reminder_ar",
    language: "ar",
    status: "APPROVED",
    category: "MARKETING",
    components: [
      { type: "BODY", text: "أهلاً {{1}}، سلتك بانتظارك بقيمة {{2}}" },
      {
        type: "BUTTONS",
        buttons: [
          { type: "URL", text: "أكمل الطلب", url: "https://salla.sa/{{1}}" },
        ],
      },
    ],
  },
  {
    id: "222",
    name: "promo_named",
    language: "en_US",
    status: "REJECTED",
    category: "MARKETING",
    parameter_format: "NAMED",
    components: [
      { type: "HEADER", format: "TEXT", text: "Hi {{first_name}}" },
      { type: "BODY", text: "Use {{code}} today" },
      { type: "FOOTER", text: "Reply STOP to opt out" },
    ],
  },
];

/** Salla (introspect, store, user info), Upstash and Meta. */
function mockNetwork({
  merchantId = 1,
  redis = fakeRedis(),
  meta,
  storeInfo,
} = {}) {
  const calls = [];
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    const u = String(url);
    calls.push({ url: u, init });
    const json = (status, data) =>
      new Response(JSON.stringify(data), { status });
    if (u.startsWith(KV_URL)) {
      return json(200, { result: redis.run(JSON.parse(init.body)) });
    }
    if (u.includes("introspect")) {
      return json(200, { success: true, data: { merchant_id: merchantId } });
    }
    if (u.endsWith("/store/info")) {
      return storeInfo
        ? json(storeInfo.status, storeInfo.body)
        : json(200, {
            success: true,
            data: {
              id: merchantId,
              name: "متجر تجريبي",
              username: "dev-store",
              entity: "company",
              plan: "pro",
              status: "active",
              verified: false,
              currency: "SAR",
              domain: "https://demostore.salla.sa/dev-store",
              licenses: { tax_number: "300000000000003" },
              default_branch: {
                name: "الفرع الرئيسي",
                city: { name: "الرياض" },
                country: { name: "السعودية" },
                is_cod_available: true,
              },
              owner: { name: "Ali", email: "a@x.sa", id: 5 },
            },
          });
    }
    if (u.includes("accounts.salla.sa/oauth2/user/info")) {
      return json(200, {
        status: 200,
        success: true,
        data: {
          id: 9,
          name: "Ali",
          email: "a@x.sa",
          role: "user",
          merchant: { id: merchantId, commercial_number: "3552100509" },
        },
      });
    }
    if (u.includes("graph.facebook.com")) {
      const res = meta?.(u) || null;
      if (res) return json(res.status, res.body);
      if (u.includes("/message_templates")) {
        return json(200, { data: META_TEMPLATES, paging: {} });
      }
      return json(200, {
        display_phone_number: "15551890829",
        verified_name: "My Store",
        quality_rating: "GREEN",
      });
    }
    return json(404, { success: false });
  });
  const graph = () => calls.filter((c) => c.url.includes("graph.facebook.com"));
  const salla = () => calls.filter((c) => c.url.includes("/admin/v2/"));
  return { calls, redis, graph, salla };
}

const call = (handler, body) =>
  handler(
    new Request("http://localhost/api/x", {
      method: "POST",
      body: JSON.stringify({ token: "tok", appId: "123", ...body }),
    }),
  );

const ACCOUNT = {
  phoneNumberId: PHONE_ID,
  wabaId: WABA,
  accessToken: "EAAmerchantTokenValue1234abcd",
};

const saved = { ...process.env };

describe("Settings: WhatsApp account and templates", () => {
  beforeEach(() => {
    process.env.KV_REST_API_URL = KV_URL;
    process.env.KV_REST_API_TOKEN = "kv-token";
    process.env.WA_SETTINGS_KEY = randomBytes(32).toString("base64");
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    process.env = { ...saved };
    vi.restoreAllMocks();
  });

  it("saves the account (checked with Meta) and reads the templates", async () => {
    const { redis, graph } = mockNetwork();
    const res = await (
      await call(whatsapp, { action: "account_save", account: ACCOUNT })
    ).json();

    expect(res.settings).toMatchObject({
      phoneNumberId: PHONE_ID,
      wabaId: WABA,
      tokenLast4: "abcd",
      profile: { verifiedName: "My Store" },
    });
    expect(JSON.stringify(res)).not.toContain(ACCOUNT.accessToken);
    const record = JSON.parse(redis.store.get("wa:settings:1"));
    expect(open(record.token)).toBe(ACCOUNT.accessToken);

    expect(graph().map((c) => c.url)).toEqual([
      expect.stringContaining(`/${PHONE_ID}?fields=`),
      expect.stringContaining(`/${WABA}/message_templates?fields=`),
    ]);
    expect(res.templatesError).toBeNull();
    expect(res.templates.templates).toEqual([
      expect.objectContaining({
        name: "cart_reminder_ar",
        status: "APPROVED",
        category: "MARKETING",
        body: "أهلاً {{1}}، سلتك بانتظارك بقيمة {{2}}",
        variables: { header: [], body: ["1", "2"], buttons: 1 },
      }),
      expect.objectContaining({
        name: "promo_named",
        parameterFormat: "NAMED",
        header: { format: "TEXT", text: "Hi {{first_name}}" },
        footer: "Reply STOP to opt out",
        variables: { header: ["first_name"], body: ["code"], buttons: 0 },
      }),
    ]);

    const list = await (
      await call(whatsapp, { action: "templates_list" })
    ).json();
    expect(list.templates).toHaveLength(2);
    expect(list.syncedAt).toBeTruthy();
  });

  it("needs the WABA ID and keeps the cart template and saved token", async () => {
    const { redis } = mockNetwork();
    redis.store.set(
      "wa:settings:1",
      JSON.stringify({
        phoneNumberId: PHONE_ID,
        template: "cart_reminder_ar",
        language: "ar",
        params: ["customer_name"],
        token: seal("EAAoldTokenValue000000000000"),
        tokenLast4: "0000",
        enabled: false,
      }),
    );
    const noWaba = await call(whatsapp, {
      action: "account_save",
      account: { phoneNumberId: PHONE_ID, wabaId: "" },
    });
    expect(noWaba.status).toBe(422);
    expect((await noWaba.json()).fields.wabaId).toBeTruthy();

    await call(whatsapp, {
      action: "account_save",
      account: { phoneNumberId: PHONE_ID, wabaId: WABA, accessToken: "" },
    });
    const record = JSON.parse(redis.store.get("wa:settings:1"));
    expect(record).toMatchObject({
      wabaId: WABA,
      template: "cart_reminder_ar",
      params: ["customer_name"],
      tokenLast4: "0000",
      enabled: false,
    });
    expect(open(record.token)).toBe("EAAoldTokenValue000000000000");
  });

  it("explains a token that can't read templates, and pages through them", async () => {
    const redis = fakeRedis();
    mockNetwork({
      redis,
      meta: (u) =>
        u.includes("/message_templates")
          ? { status: 403, body: { error: { code: 200, message: "perm" } } }
          : null,
    });
    const saved = await (
      await call(whatsapp, { action: "account_save", account: ACCOUNT })
    ).json();
    expect(saved.success).toBe(true);
    expect(saved.templatesError).toMatch(/whatsapp_business_management/);

    const { graph } = mockNetwork({
      redis,
      meta: (u) => {
        if (!u.includes("/message_templates")) return null;
        return u.includes("after=CUR")
          ? { status: 200, body: { data: [META_TEMPLATES[1]], paging: {} } }
          : {
              status: 200,
              body: {
                data: [META_TEMPLATES[0]],
                paging: { cursors: { after: "CUR" }, next: "https://graph…" },
              },
            };
      },
    });
    const sync = await (
      await call(whatsapp, { action: "templates_sync" })
    ).json();
    expect(sync.templates.map((t) => t.name)).toEqual([
      "cart_reminder_ar",
      "promo_named",
    ]);
    expect(graph()).toHaveLength(2);
  });

  it("forgets the templates when the account is disconnected", async () => {
    const { redis } = mockNetwork();
    await call(whatsapp, { action: "account_save", account: ACCOUNT });
    expect(redis.store.has("wa:templates:1")).toBe(true);
    await call(whatsapp, { action: "settings_delete" });
    expect(redis.store.has("wa:templates:1")).toBe(false);
    expect(redis.store.has("wa:settings:1")).toBe(false);
  });
});

describe("Settings: store details", () => {
  beforeEach(() => {
    process.env.KV_REST_API_URL = KV_URL;
    process.env.KV_REST_API_TOKEN = "kv-token";
    process.env.WA_SETTINGS_KEY = randomBytes(32).toString("base64");
  });
  afterEach(() => {
    process.env = { ...saved };
  });

  const authorize = () =>
    saveTokens("1", {
      accessToken: "ACCESS-1",
      refreshToken: "REFRESH-1",
      expiresAt: Date.now() + 10 * 24 * 3600e3,
      scope: "products.read_write offline_access",
    });

  it("shows the store, the Salla account and the app's access", async () => {
    mockNetwork();
    await authorize();
    const json = await (await call(storeApi, { action: "info" })).json();
    expect(json.access).toMatchObject({
      authorized: true,
      offlineAccess: true,
      scopes: ["products.read_write", "offline_access"],
    });
    expect(json.store).toMatchObject({
      name: "متجر تجريبي",
      plan: "pro",
      licenses: { tax_number: "300000000000003" },
      owner: { name: "Ali", email: "a@x.sa", mobile: null },
      branch: {
        name: "الفرع الرئيسي",
        city: "الرياض",
        country: "السعودية",
        codAvailable: true,
      },
    });
    expect(json.user).toMatchObject({
      name: "Ali",
      merchant: { commercial_number: "3552100509" },
    });
    expect(JSON.stringify(json)).not.toContain("ACCESS-1");
  });

  it("says so when the store never authorized the app, without calling Salla", async () => {
    const { salla } = mockNetwork();
    const json = await (await call(storeApi, { action: "info" })).json();
    expect(json).toMatchObject({
      success: true,
      access: { authorized: false },
      store: null,
      user: null,
    });
    expect(salla()).toEqual([]);
  });

  it("keeps the account details when the store details fail", async () => {
    mockNetwork({
      storeInfo: {
        status: 403,
        body: { success: false, error: { message: "scope missing" } },
      },
    });
    await authorize();
    const json = await (await call(storeApi, { action: "info" })).json();
    expect(json.store).toBeNull();
    expect(json.errors.store).toMatch(/صلاحية/);
    expect(json.user.name).toBe("Ali");
  });
});
