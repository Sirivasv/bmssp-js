import { describe, test, expect } from "@jest/globals";
import { printMessage } from "../src/bmssp.mjs";

describe("printMessage", () => {
  test("sends a message and gets the message back", () => {
    let testValue = "Hello, bmssp!! Testing..";
    expect(printMessage(testValue)).toBe(testValue);
  });
});

describe("processMessage", () => {
  test("processes a message and returns the processed result", () => {
    let testValue = "Hello, bmssp!! Testing..";
    expect(processMessage(testValue)).toBe(`Processed: ${testValue}`);
  });
});
