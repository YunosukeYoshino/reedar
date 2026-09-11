import { expect, test } from "bun:test";
import { resolve } from "node:path";

test("desktop bundle does not resolve its web assets against the developer source directory", async () => {
  const result = await Bun.build({ entrypoints: ["src/main/electron.ts"], target: "node", format: "cjs", packages: "bundle", external: ["electron", "electron-updater"] });
  expect(result.success).toBe(true);
  const bundle = await result.outputs[0]?.text();
  expect(bundle).toBeDefined();
  expect(bundle?.includes(resolve("src/main"))).toBe(false);
});
