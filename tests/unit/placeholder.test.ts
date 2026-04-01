import { expect, test } from "bun:test";
import { VERSION } from "../../src/index";

test("version is 0.1.0", () => {
  expect(VERSION).toBe("0.1.0");
});
