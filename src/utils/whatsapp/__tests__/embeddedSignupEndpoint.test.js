// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac, randomBytes } from "node:crypto";
import { POST as whatsapp } from "../../../../api/whatsapp.js";
import {
  GET as metaWebhookGet,
  POST as metaWebhookPost,
} from "../../../../api/meta-webhook.js";
import { open, seal } from "../../../../api/_lib/secretBox.js";
import { fakeRedis } from "../../../test/fakeRedis.js";

const KV_URL = "https://kv.example.upstash.io";
const WABA = "1478536534308215";
const PHONE_ID = "1324055010792496";
const APP_SECRET = "meta-app-secret-value";
const BUSINESS_TOKEN = "EAAbusinessIntegrationToken9876wxyz";

/**
 * Upstash, Salla introspect and Meta. `meta(url, init)` may answer a Graph
 * call first; otherwise every step succeeds.
 */
function mockNetwork({ redis = fakeRedis(), meta } = {}) {
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
      return json(200, { success: true, data: { merchant_id: 1 } });
    }
    if (u.includes("graph.facebook.com")) {
      const res = meta?.(u, init) || null;
      if (res) return json(res.status, res.body);
      if (u.includes("/oauth/access_token")) {
        return json(200, {
          access_token: BUSINESS_TOKEN,
          token_type: "bearer",
        });
      }
      if (u.includes("/message_templates")) {
        return json(200, { data: [], paging: {} });
      }
      if (u.includes("/subscribed_apps") || u.includes("/register")) {
        return json(200, { success: true });
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
  return { redis, graph };
}

const call = (body) =>
  whatsapp(
    new Request("http://localhost/api/whatsapp", {
      method: "POST",
      body: JSON.stringify({ token: "tok", appId: "123", ...body }),
    }),
  );

const COMPLETE = {
  action: "signup_complete",
  code: "AQcode-from-fb-login",
  wabaId: WABA,
  phoneNumberId: PHONE_ID,
};

const saved = { ...process.env };

describe("Embedded Signup (api/whatsapp.js)", () => {
  beforeEach(() => {
    process.env.KV_REST_API_URL = KV_URL;
    process.env.KV_REST_API_TOKEN = "kv-token";
    process.env.WA_SETTINGS_KEY = randomBytes(32).toString("base64");
    process.env.META_APP_ID = "998877665544";
    process.env.META_APP_SECRET = APP_SECRET;
    process.env.META_ES_CONFIG_ID = "1122334455";
    vi.spyOn(console, "error").mockImplementation(() => {});
  });
  afterEach(() => {
    process.env = { ...saved };
    vi.restoreAllMocks();
  });

  it("gives the browser the public ids only", async () => {
    mockNetwork();
    const res = await (await call({ action: "signup_config" })).json();
    expect(res).toMatchObject({
      success: true,
      available: true,
      appId: "998877665544",
      configId: "1122334455",
      version: "v23.0",
    });
    expect(JSON.stringify(res)).not.toContain(APP_SECRET);

    delete process.env.META_ES_CONFIG_ID;
    const off = await (await call({ action: "signup_config" })).json();
    expect(off).toMatchObject({ available: false, appId: null });
  });

  it("exchanges the code, subscribes the WABA, registers the number and saves it", async () => {
    const { redis, graph } = mockNetwork({
      meta: (u) =>
        u.includes("/message_templates")
          ? {
              status: 200,
              body: {
                data: [
                  {
                    id: "111",
                    name: "cart_reminder_ar",
                    language: "ar",
                    status: "APPROVED",
                    category: "MARKETING",
                    components: [{ type: "BODY", text: "أهلاً {{1}}" }],
                  },
                ],
                paging: {},
              },
            }
          : null,
    });
    const res = await (await call(COMPLETE)).json();

    expect(res).toMatchObject({
      success: true,
      warnings: [],
      templatesError: null,
      settings: {
        phoneNumberId: PHONE_ID,
        wabaId: WABA,
        tokenLast4: "wxyz",
        source: "embedded_signup",
        enabled: true,
        profile: { verifiedName: "My Store" },
      },
    });
    expect(res.templates.templates).toHaveLength(1);

    const calls = graph();
    expect(calls.map((c) => c.url)).toEqual([
      expect.stringContaining("/oauth/access_token?"),
      expect.stringContaining(`/${PHONE_ID}?fields=`),
      expect.stringContaining(`/${WABA}/subscribed_apps`),
      expect.stringContaining(`/${PHONE_ID}/register`),
      expect.stringContaining(`/${WABA}/message_templates?`),
    ]);
    const exchange = new URL(calls[0].url).searchParams;
    expect(exchange.get("client_id")).toBe("998877665544");
    expect(exchange.get("client_secret")).toBe(APP_SECRET);
    expect(exchange.get("code")).toBe(COMPLETE.code);
    // Every later call uses the merchant's business token.
    for (const c of calls.slice(1)) {
      expect(c.init.headers.Authorization).toBe(`Bearer ${BUSINESS_TOKEN}`);
    }
    const register = JSON.parse(calls[3].init.body);
    expect(register.messaging_product).toBe("whatsapp");
    expect(register.pin).toMatch(/^\d{6}$/);

    const record = JSON.parse(redis.store.get("wa:settings:1"));
    expect(open(record.token)).toBe(BUSINESS_TOKEN);
    expect(open(record.pin)).toBe(register.pin);
    // Nothing secret goes back to the browser.
    const text = JSON.stringify(res);
    for (const secret of [BUSINESS_TOKEN, APP_SECRET, register.pin]) {
      expect(text).not.toContain(secret);
    }
  });

  it("stops when Meta rejects the code, saving nothing", async () => {
    const { redis, graph } = mockNetwork({
      meta: (u) =>
        u.includes("/oauth/access_token")
          ? {
              status: 400,
              body: {
                error: {
                  message: "This authorization code has expired.",
                  code: 100,
                },
              },
            }
          : null,
    });
    const response = await call(COMPLETE);
    const res = await response.json();
    expect(response.status).toBe(422);
    expect(res.code).toBe("signup_code_rejected");
    expect(res.detail).toBe("This authorization code has expired.");
    expect(JSON.stringify(res)).not.toContain(APP_SECRET);
    expect(graph()).toHaveLength(1);
    expect(redis.store.has("wa:settings:1")).toBe(false);
  });

  it("keeps the connection when subscribing or registering fails, with warnings", async () => {
    const { redis } = mockNetwork({
      meta: (u) =>
        u.includes("/register") || u.includes("/subscribed_apps")
          ? {
              status: 400,
              body: {
                error: {
                  message: "Two step verification PIN Mismatch",
                  code: 133005,
                },
              },
            }
          : null,
    });
    const res = await (await call(COMPLETE)).json();
    expect(res.success).toBe(true);
    expect(res.warnings).toHaveLength(2);
    expect(res.warnings[0]).toMatch(/إشعارات Meta/);
    expect(res.warnings[1]).toMatch(/تفعيل الرقم/);
    const record = JSON.parse(redis.store.get("wa:settings:1"));
    expect(open(record.token)).toBe(BUSINESS_TOKEN);
    expect(record.pin).toBeUndefined();
  });

  it("reuses the number's PIN when the same number connects again, keeping the switch", async () => {
    const { redis, graph } = mockNetwork();
    redis.store.set(
      "wa:settings:1",
      JSON.stringify({
        phoneNumberId: PHONE_ID,
        wabaId: WABA,
        token: seal("EAAoldTokenValue000000000"),
        pin: seal("482913"),
        enabled: false,
      }),
    );
    const res = await (await call(COMPLETE)).json();
    expect(res.settings.enabled).toBe(false);
    const register = graph().find((c) => c.url.includes("/register"));
    expect(JSON.parse(register.init.body).pin).toBe("482913");
  });

  it("refuses missing ids without calling Meta, and says when it's not set up", async () => {
    const { graph } = mockNetwork();
    const bad = await call({ ...COMPLETE, phoneNumberId: "abc" });
    expect(bad.status).toBe(422);
    expect(graph()).toHaveLength(0);

    delete process.env.META_APP_SECRET;
    const off = await call(COMPLETE);
    expect(off.status).toBe(503);
    expect((await off.json()).code).toBe("signup_not_configured");
  });

  it("marks a typed token as a manual account", async () => {
    const { redis } = mockNetwork();
    redis.store.set(
      "wa:settings:1",
      JSON.stringify({
        phoneNumberId: PHONE_ID,
        wabaId: WABA,
        token: seal(BUSINESS_TOKEN),
        source: "embedded_signup",
        pin: seal("482913"),
      }),
    );
    const res = await (
      await call({
        action: "account_save",
        account: {
          phoneNumberId: PHONE_ID,
          wabaId: WABA,
          accessToken: "EAAmanualTokenValue1234abcd",
        },
      })
    ).json();
    expect(res.settings.source).toBe("manual");
    // Same number: its PIN still applies.
    const record = JSON.parse(redis.store.get("wa:settings:1"));
    expect(open(record.pin)).toBe("482913");
  });
});

describe("Meta webhook (api/meta-webhook.js)", () => {
  beforeEach(() => {
    process.env.META_APP_SECRET = APP_SECRET;
    process.env.META_WEBHOOK_VERIFY_TOKEN = "verify-me";
    vi.spyOn(console, "info").mockImplementation(() => {});
  });
  afterEach(() => {
    process.env = { ...saved };
    vi.restoreAllMocks();
  });

  const verifyUrl = (token) =>
    `http://localhost/api/meta-webhook?hub.mode=subscribe&hub.verify_token=${token}&hub.challenge=1158201444`;

  it("answers Meta's verification with the challenge", async () => {
    const ok = await metaWebhookGet(new Request(verifyUrl("verify-me")));
    expect(ok.status).toBe(200);
    expect(await ok.text()).toBe("1158201444");
    const bad = await metaWebhookGet(new Request(verifyUrl("wrong")));
    expect(bad.status).toBe(403);
  });

  it("accepts only deliveries signed with the app secret", async () => {
    const body = JSON.stringify({
      object: "whatsapp_business_account",
      entry: [{ id: WABA, changes: [{ field: "account_update", value: {} }] }],
    });
    const signature = `sha256=${createHmac("sha256", APP_SECRET).update(body).digest("hex")}`;
    const post = (sig) =>
      metaWebhookPost(
        new Request("http://localhost/api/meta-webhook", {
          method: "POST",
          headers: { "X-Hub-Signature-256": sig },
          body,
        }),
      );
    expect((await post(signature)).status).toBe(200);
    expect((await post("sha256=00")).status).toBe(401);
    expect((await post("")).status).toBe(401);
  });
});
