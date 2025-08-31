import { describe, test, expect } from "@jest/globals";
import { printMessage } from "../src/bmssp.mjs";

describe("printMessage", () => {
  test("sends a message and gets the message back", () => {
    expect(printMessage("Hello, World!")).toBe("Hello, World!");
  });
});
