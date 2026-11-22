import { describe, expect, it } from "vitest";
import { linkify } from "./linkify";

describe("linkify", () => {
  it("returns plain text untouched", () => {
    expect(linkify("hello world")).toEqual([{ type: "text", value: "hello world" }]);
  });

  it("extracts http and https links and keeps surrounding text", () => {
    expect(linkify("see https://example.com/a?b=1 now")).toEqual([
      { type: "text", value: "see " },
      { type: "link", value: "https://example.com/a?b=1", href: "https://example.com/a?b=1" },
      { type: "text", value: " now" },
    ]);
  });

  it("does not swallow trailing punctuation", () => {
    const parts = linkify("(https://example.com/x).");
    expect(parts).toEqual([
      { type: "text", value: "(" },
      { type: "link", value: "https://example.com/x", href: "https://example.com/x" },
      { type: "text", value: ")." },
    ]);
  });

  it("never links other schemes", () => {
    expect(linkify("javascript:alert(1) data:text/html,x ftp://a.b")).toEqual([
      { type: "text", value: "javascript:alert(1) data:text/html,x ftp://a.b" },
    ]);
  });
});
