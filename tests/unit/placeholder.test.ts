import { expect, test } from "bun:test";
import packageJson from "../../package.json";
import { VERSION } from "../../src/index";

test("version matches package.json", () => {
  expect(VERSION).toBe(packageJson.version);
});
