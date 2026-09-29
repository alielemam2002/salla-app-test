// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  POST,
  buildBarSettings,
  sallaDateToIso,
} from "../../../../api/coupon-bar.js";
import { defaultBarText } from "../couponBar.js";

const INTROSPECT_OK = {
  status: 200,
  body: { success: true, data: { merchant_id: 1, user_id: 2 } },
};

const settingsResponse = (settings) => ({
  status: 200,
  body: { success: true, data: { app_id: "123", settings } },
});

const OK = { status: 200, body: { success: true, data: {} } };

/** Queue fetch responses in call order and record requests. */
function mockFetch(responses) {
  const calls = [];
  globalThis.fetch = vi.fn(async (url, init = {}) => {
    calls.push({
      url: String(url),
      method: init.method || "GET",
      body: init.body ? JSON.parse(init.body) : undefined,
    });
    const next = responses[calls.length - 1] || responses[responses.length - 1];
    return new Response(JSON.stringify(next.body), { status: next.status });
  });
  return calls;
}

const call = (body) =>
  POST(
    new Request("http://localhost/api/coupon-bar", {
      method: "POST",
      body: JSON.stringify({ token: "tok", appId: "123", ...body }),
    }),
  );

const BAR = {
  code: "SUMMER20",
  text: "استخدم كود SUMMER20",
  bg_color: "#004d5b",
  text_color: "#ffffff",
  ends_at: "2026-10-05 23:59:00",
};

const LIVE = {
  coupon_bar_enabled: true,
  coupon_bar_code: "OLD5",
  coupon_bar_text: "old",
  coupon_bar_bg_color: "#000000",
  coupon_bar_text_color: "#ffffff",
  coupon_bar_ends_at: "2026-10-01T00:00:00+03:00",
};

describe("api/coupon-bar", () => {
  const savedEnv = { ...process.env };
  beforeEach(() => {
    process.env.SALLA_ACCESS_TOKEN = "access";
    delete process.env.SALLA_APP_ID;
  });
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it("converts Salla store time to an ISO date with the +03:00 offset", () => {
    expect(sallaDateToIso("2026-10-05 23:59:00")).toBe(
      "2026-10-05T23:59:00+03:00",
    );
    expect(sallaDateToIso("2026-10-05 23:59")).toBe(
      "2026-10-05T23:59:00+03:00",
    );
    expect(sallaDateToIso("nope")).toBe("");
  });

  it("validates bar input", () => {
    const { fields } = buildBarSettings({
      code: "HAS SPACE",
      text: "x".repeat(201),
      bg_color: "red",
      text_color: "#fff",
    });
    expect(Object.keys(fields).sort()).toEqual(
      ["bg_color", "code", "ends_at", "text", "text_color"].sort(),
    );
  });

  it("returns null when no bar is on", async () => {
    const calls = mockFetch([
      INTROSPECT_OK,
      settingsResponse([]),
      { status: 200, body: { success: true, data: { id: 77 } } },
    ]);
    const res = await call({ action: "get" });
    expect(await res.json()).toEqual({
      success: true,
      bar: null,
      storeId: 77,
      merchantId: 1,
    });
    expect(calls[2].url).toBe("https://api.salla.dev/admin/v2/store/info");
  });

  it("treats Salla's 'no settings yet' 404 as empty settings", async () => {
    const NO_SETTINGS = {
      status: 404,
      body: { success: false, error: { message: "لايوجد اعدادت للتطبيق" } },
    };
    mockFetch([INTROSPECT_OK, NO_SETTINGS]);
    expect(await (await call({ action: "get" })).json()).toMatchObject({
      success: true,
      bar: null,
    });

    const calls = mockFetch([INTROSPECT_OK, NO_SETTINGS, OK]);
    const res = await call({ action: "set", bar: BAR });
    expect((await res.json()).bar.code).toBe("SUMMER20");
    expect(calls[2].method).toBe("POST");
  });

  it("explains a rejected save", async () => {
    mockFetch([
      INTROSPECT_OK,
      settingsResponse([]),
      { status: 422, body: { success: false, error: { message: "nope" } } },
    ]);
    const res = await call({ action: "set", bar: BAR });
    const json = await res.json();
    expect(res.status).toBe(422);
    expect(json.code).toBe("settings_not_saved");
    expect(json.error).toMatch(/nope.*coupon_bar_\* fields/);
  });

  it("merges the bar into the existing settings and sends every key", async () => {
    const calls = mockFetch([
      INTROSPECT_OK,
      settingsResponse({ other_setting: "keep me", ...LIVE }),
      OK,
    ]);
    const res = await call({ action: "set", bar: BAR });
    const json = await res.json();

    expect(json.success).toBe(true);
    expect(json.bar.code).toBe("SUMMER20");
    const post = calls[2];
    expect(post.url).toBe("https://api.salla.dev/admin/v2/apps/123/settings");
    expect(post.method).toBe("POST");
    expect(post.body).toEqual({
      other_setting: "keep me",
      coupon_bar_enabled: true,
      coupon_bar_code: "SUMMER20",
      coupon_bar_text: "استخدم كود SUMMER20",
      coupon_bar_bg_color: "#004d5b",
      coupon_bar_text_color: "#ffffff",
      coupon_bar_ends_at: "2026-10-05T23:59:00+03:00",
    });
  });

  it("rejects invalid input without touching Salla settings", async () => {
    const calls = mockFetch([INTROSPECT_OK]);
    const res = await call({ action: "set", bar: { ...BAR, bg_color: "x" } });
    expect(res.status).toBe(422);
    expect((await res.json()).fields.bg_color).toBeDefined();
    expect(calls).toHaveLength(1);
  });

  it("clears only the bar that belongs to the given coupon", async () => {
    let calls = mockFetch([INTROSPECT_OK, settingsResponse(LIVE), OK]);
    await call({ action: "clear", code: "SUMMER20" });
    expect(calls).toHaveLength(2); // no POST: the bar is OLD5's

    calls = mockFetch([INTROSPECT_OK, settingsResponse(LIVE), OK]);
    const res = await call({ action: "clear", code: "OLD5" });
    expect((await res.json()).bar).toBeNull();
    expect(calls[2].body).toEqual({ ...LIVE, coupon_bar_enabled: false });
  });

  it("rejects an invalid session", async () => {
    mockFetch([
      { status: 401, body: { success: false, error: { message: "bad" } } },
    ]);
    const res = await call({ action: "get" });
    expect(res.status).toBe(401);
    expect((await res.json()).code).toBe("session_invalid");
  });
});

describe("defaultBarText", () => {
  it("builds Arabic text for each discount type", () => {
    expect(defaultBarText({ code: "A", type: "percentage", amount: 20 })).toBe(
      "استخدم كود A واحصل على خصم 20%",
    );
    expect(
      defaultBarText({
        code: "B",
        type: "fixed",
        amount: 50,
        free_shipping: true,
      }),
    ).toBe("استخدم كود B واحصل على خصم 50 ر.س + شحن مجاني");
    expect(defaultBarText({ code: "C", amount: "" })).toBe("استخدم كود C");
  });
});
