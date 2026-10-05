// @vitest-environment node
import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

// Every api/*.js (not _-prefixed) is one Vercel function; the Hobby plan
// refuses a deployment with more than 12 ("Build Failed").
const HOBBY_FUNCTION_LIMIT = 12;

describe("Vercel functions", () => {
  it("stays within the Hobby plan's function limit", () => {
    const functions = readdirSync(resolve(root, "api")).filter(
      (name) => name.endsWith(".js") && !name.startsWith("_"),
    );
    expect(functions.length).toBeLessThanOrEqual(HOBBY_FUNCTION_LIMIT);
  });

  it("rewrites only to functions that exist", () => {
    const config = JSON.parse(readFileSync(resolve(root, "vercel.json")));
    for (const { source, destination } of config.rewrites || []) {
      expect(existsSync(resolve(root, `.${source}.js`))).toBe(false);
      expect(existsSync(resolve(root, `.${destination}.js`))).toBe(true);
    }
  });
});
