import { describe, test, expect } from "@jest/globals";
import { printMessage } from "../src/bmssp.mjs";

describe("printMessage", () => {
  test("sends a message gets the message back", () => {
    let testValue = "Hello, World v0.7.0!";
    expect(printMessage(testValue)).toBe(testValue);
  });
});
