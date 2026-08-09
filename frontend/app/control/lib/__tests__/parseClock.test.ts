import { describe, it, expect } from "vitest";
import { parseClock } from "../parseClock";

describe("parseClock", () => {
  it("parses MM:SS into total seconds", () => {
    expect(parseClock("12:34")).toBe(12 * 60 + 34);
  });

  it("parses a single-digit minute with colon", () => {
    expect(parseClock("1:05")).toBe(65);
  });

  it("parses a three-digit minute with colon", () => {
    expect(parseClock("120:00")).toBe(120 * 60);
  });

  it("parses plain seconds with no colon", () => {
    expect(parseClock("45")).toBe(45);
  });

  it("parses zero seconds", () => {
    expect(parseClock("0")).toBe(0);
  });

  it("trims surrounding whitespace before parsing", () => {
    expect(parseClock("  90  ")).toBe(90);
    expect(parseClock("  1:30  ")).toBe(90);
  });

  it("returns null for a negative plain-seconds value", () => {
    expect(parseClock("-5")).toBeNull();
  });

  it("returns null for non-numeric garbage", () => {
    expect(parseClock("abc")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseClock("")).toBeNull();
  });

  it("falls back to plain-seconds parsing when the seconds portion of MM:SS isn't two digits", () => {
    // regex requires exactly two digits after the colon, so "12:3" doesn't
    // match — it falls through to Number.parseInt, which reads the leading
    // digits up to the colon.
    expect(parseClock("12:3")).toBe(12);
  });

  it("falls back to plain-seconds parsing when the colon format has more than 3 minute digits", () => {
    // regex caps minutes at 1-3 digits, so "1234:00" doesn't match and
    // falls through to Number.parseInt reading the leading digit run.
    expect(parseClock("1234:00")).toBe(1234);
  });

  it("falls back to plain-seconds parsing for malformed colon input, taking the leading digits", () => {
    // "12:345" doesn't match the strict MM:SS pattern (3-digit seconds),
    // so it falls through to Number.parseInt which reads the leading run
    // of digits before the colon.
    expect(parseClock("12:345")).toBe(12);
  });
});
