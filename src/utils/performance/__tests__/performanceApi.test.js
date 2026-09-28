import { describe, it, expect, vi, afterEach } from "vitest";
import { runPerformanceTest } from "../performanceApi.js";

function mockFetch(response) {
  global.fetch = vi.fn().mockResolvedValue(response);
}

describe("runPerformanceTest errors", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("surfaces the server's error message and code", async () => {
    mockFetch(
      new Response(
        JSON.stringify({
          success: false,
          code: "page_unreachable",
          error: "تعذّر على Google تحميل صفحة المتجر.",
        }),
        { status: 422 },
      ),
    );
    await expect(
      runPerformanceTest("https://store.example.sa", { strategy: "mobile" }),
    ).rejects.toMatchObject({
      code: "page_unreachable",
      status: 422,
      message: "تعذّر على Google تحميل صفحة المتجر.",
    });
  });

  it("handles a non-JSON platform timeout page", async () => {
    mockFetch(new Response("<html>Gateway Timeout</html>", { status: 504 }));
    await expect(
      runPerformanceTest("https://store.example.sa"),
    ).rejects.toMatchObject({ code: "timeout", status: 504 });
  });

  it("handles other non-JSON failures", async () => {
    mockFetch(new Response("Bad Gateway", { status: 502 }));
    await expect(
      runPerformanceTest("https://store.example.sa"),
    ).rejects.toMatchObject({ code: "invalid_response", status: 502 });
  });
});
