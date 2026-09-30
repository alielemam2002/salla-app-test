import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The storefront snippet is plain JS for the Partners Portal: run it the
// way the store does, against a fake Twilight SDK.
const code = readFileSync(
  resolve(process.cwd(), "storefront/reorder-snippet.js"),
  "utf8",
);

function fakeSalla({ userId = 55, userType, fail = false } = {}) {
  return {
    onReady: (cb) => cb(),
    config: {
      get: (key) =>
        ({
          "user.id": userId,
          "user.type": userType || (userId ? "user" : "guest"),
        })[key],
    },
    event: { emit: vi.fn() },
    notify: { info: vi.fn(), error: vi.fn(), success: vi.fn() },
    order: {
      createCartFromOrder: vi.fn(() =>
        fail
          ? Promise.reject(new Error("not your order"))
          : Promise.resolve({ success: true, data: { id: 9 } }),
      ),
    },
    cart: { addCoupon: vi.fn(() => Promise.resolve({ success: true })) },
    url: { get: vi.fn(() => "#cart") },
  };
}

function run(query, salla) {
  window.history.pushState({}, "", `/${query}`);
  globalThis.salla = salla;
  new Function(code)();
  return salla;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("storefront reorder snippet", () => {
  beforeEach(() => {
    window.sessionStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
    delete globalThis.salla;
    window.history.pushState({}, "", "/");
  });

  it("parses as a plain script (what the Portal accepts)", () => {
    expect(() => new Function(code)).not.toThrow();
    // Salla's validator scans the raw text, comments included. Its docs ban
    // iframe/embed tags, history.replaceState, eval and similar dynamic
    // code; keep those and their close relatives out of the whole file.
    for (const banned of [
      "replaceState",
      "pushState",
      "eval",
      "iframe",
      "embed",
      "Function(",
      "document.write",
    ]) {
      expect(code, banned).not.toContain(banned);
    }
  });

  it("does nothing without a reorder link", () => {
    const salla = run("?page=1", fakeSalla());
    expect(salla.order.createCartFromOrder).not.toHaveBeenCalled();
    expect(salla.event.emit).not.toHaveBeenCalled();
  });

  it("asks a guest to log in first", () => {
    const salla = run("?reorder=123", fakeSalla({ userId: null }));
    expect(salla.event.emit).toHaveBeenCalledWith("login::open");
    expect(salla.order.createCartFromOrder).not.toHaveBeenCalled();
    expect(salla.notify.info).toHaveBeenCalledWith(
      expect.stringMatching(/سجّل دخولك/),
    );
  });

  it("treats a guest session id as a guest (what Salla stores set)", () => {
    // A live store gives guests a random session id with type "guest".
    const salla = run(
      "?reorder=123",
      fakeSalla({
        userId: "nlRQPeVFPuReqUaCzLpEHJF0uXweaLQ7H4ftZXQc",
        userType: "guest",
      }),
    );
    expect(salla.event.emit).toHaveBeenCalledWith("login::open");
    expect(salla.order.createCartFromOrder).not.toHaveBeenCalled();
  });

  it("rebuilds the order's cart and applies the coupon", async () => {
    const salla = run("?reorder=2116149737&coupon=LOYAL10", fakeSalla());
    expect(salla.order.createCartFromOrder).toHaveBeenCalledWith({
      id: 2116149737,
    });
    await flush();
    expect(salla.cart.addCoupon).toHaveBeenCalledWith("LOYAL10");
  });

  it("opens the cart if Salla didn't redirect", async () => {
    vi.useFakeTimers();
    const salla = run("?reorder=123", fakeSalla());
    await vi.runAllTimersAsync();
    expect(salla.url.get).toHaveBeenCalledWith("cart");
  });

  it("ignores bad ids and coupons", async () => {
    const bad = run("?reorder=12abc", fakeSalla());
    expect(bad.order.createCartFromOrder).not.toHaveBeenCalled();

    const salla = run("?reorder=123&coupon=<script>", fakeSalla());
    expect(salla.order.createCartFromOrder).toHaveBeenCalled();
    await flush();
    expect(salla.cart.addCoupon).not.toHaveBeenCalled();
  });

  it("rebuilds once per tab, but allows a retry after a failure", async () => {
    const first = run("?reorder=123", fakeSalla());
    expect(first.order.createCartFromOrder).toHaveBeenCalledTimes(1);
    const again = run("?reorder=123", fakeSalla());
    expect(again.order.createCartFromOrder).not.toHaveBeenCalled();

    window.sessionStorage.clear();
    const failed = run("?reorder=456", fakeSalla({ fail: true }));
    await flush();
    expect(failed.notify.error).toHaveBeenCalledWith(
      expect.stringMatching(/تعذّر إعادة الطلب/),
    );
    const retry = run("?reorder=456", fakeSalla());
    expect(retry.order.createCartFromOrder).toHaveBeenCalledTimes(1);
  });
});
