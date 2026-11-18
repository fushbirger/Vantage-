import { describe, expect, it } from "vitest";
import {
  text,
  optionalText,
  money,
  fx,
  intCents,
  validUsername,
  isCurrencyCode,
  isSplitRule,
  isRail,
  isGroupKind,
  isCategory,
  imageDataUrl,
} from "./validation";
describe("text", () => {
  it("trims whitespace from strings", () => {
    expect(text("  hello  ")).toBe("hello");
  });

  it("returns an empty string for non-string inputs", () => {
    expect(text(123)).toBe("");
    expect(text(null)).toBe("");
    expect(text(undefined)).toBe("");
    expect(text({})).toBe("");
  });

  it("limits strings to the specified maximum length", () => {
    expect(text("abcdefgh", 5)).toBe("abcde");
  });

  it("returns an empty string when the maximum length is zero", () => {
    expect(text("hello", 0)).toBe("");
  });

  it("uses 200 characters as the default maximum length", () => {
    expect(text("a".repeat(201))).toHaveLength(200);
  });
});

describe("optionalText", () => {
  it("returns trimmed text when a non-empty string is provided", () => {
    expect(optionalText("  hello  ")).toBe("hello");
  });

  it("returns null for empty or whitespace-only strings", () => {
    expect(optionalText("")).toBeNull();
    expect(optionalText("   ")).toBeNull();
  });

  it("returns null for non-string inputs", () => {
    expect(optionalText(123)).toBeNull();
    expect(optionalText(null)).toBeNull();
    expect(optionalText(undefined)).toBeNull();
  });

  it("respects the specified maximum length", () => {
    expect(optionalText("abcdefgh", 5)).toBe("abcde");
  });

  it("uses 2000 characters as the default maximum length", () => {
    expect(optionalText("a".repeat(2001))).toHaveLength(2000);
  });
});

describe("money", () => {
  it("converts numeric amounts into integer cents", () => {
    expect(money(12.5)).toBe(1250);
    expect(money(99.99)).toBe(9999);
    expect(money(0)).toBe(0);
  });
  it("documents current rounding behaviour for decimal precision edge cases", () => {
  expect(money(1.005)).toBe(100);
 });

  it("parses formatted monetary strings", () => {
    expect(money("12.50")).toBe(1250);
    expect(money("$1,234.56")).toBe(123456);
  });

  it("handles negative amounts", () => {
    expect(money(-12.5)).toBe(-1250);
    expect(money("-12.50")).toBe(-1250);
  });

  it("returns zero for invalid or non-finite inputs", () => {
    expect(money("invalid")).toBe(0);
    expect(money(Number.NaN)).toBe(0);
    expect(money(Number.POSITIVE_INFINITY)).toBe(0);
    expect(money(null)).toBe(0);
    expect(money(undefined)).toBe(0);
  });
});

describe("fx", () => {
  it("accepts valid positive exchange rates", () => {
    expect(fx(1)).toBe(1);
    expect(fx(0.3)).toBe(0.3);
    expect(fx("1.25")).toBe(1.25);
  });

  it("rejects zero and negative exchange rates", () => {
    expect(fx(0)).toBe(0);
    expect(fx(-1)).toBe(0);
  });

  it("rejects exchange rates greater than 100", () => {
    expect(fx(100)).toBe(100);
    expect(fx(100.01)).toBe(0);
  });

  it("rejects invalid and non-finite inputs", () => {
    expect(fx("invalid")).toBe(0);
    expect(fx(Number.NaN)).toBe(0);
    expect(fx(Number.POSITIVE_INFINITY)).toBe(0);
  });

  it("rounds exchange rates to four decimal places", () => {
    expect(fx(1.234567)).toBe(1.2346);
    expect(fx(0.123456)).toBe(0.1235);
  });
});

describe("intCents", () => {
  it("rounds numeric amounts to integer cents", () => {
    expect(intCents(1250.4)).toBe(1250);
    expect(intCents(1250.6)).toBe(1251);
    expect(intCents(-1250.6)).toBe(-1251);
  });

  it("converts numeric strings into integer cents", () => {
    expect(intCents("1250")).toBe(1250);
    expect(intCents("1250.6")).toBe(1251);
  });

  it("returns zero for invalid or non-finite inputs", () => {
    expect(intCents("invalid")).toBe(0);
    expect(intCents(Number.NaN)).toBe(0);
    expect(intCents(Number.POSITIVE_INFINITY)).toBe(0);
  });
});

describe("validUsername", () => {
  it("accepts valid lowercase usernames", () => {
    expect(validUsername("aryya")).toBe(true);
    expect(validUsername("user_123")).toBe(true);
  });

  it("accepts usernames at the minimum and maximum lengths", () => {
    expect(validUsername("abc")).toBe(true);
    expect(validUsername("a".repeat(20))).toBe(true);
  });

  it("rejects usernames outside the length boundaries", () => {
    expect(validUsername("ab")).toBe(false);
    expect(validUsername("a".repeat(21))).toBe(false);
  });

  it("rejects uppercase letters and special characters", () => {
    expect(validUsername("Aryya")).toBe(false);
    expect(validUsername("user-name")).toBe(false);
    expect(validUsername("user@123")).toBe(false);
  });
});

describe("isCurrencyCode", () => {
  it.each(["BND", "SGD", "MYR", "USD"])(
    "accepts supported currency %s",
    (currency) => {
      expect(isCurrencyCode(currency)).toBe(true);
    },
  );

  it("rejects unsupported currencies and non-string values", () => {
    expect(isCurrencyCode("INR")).toBe(false);
    expect(isCurrencyCode("EUR")).toBe(false);
    expect(isCurrencyCode("bnd")).toBe(false);
    expect(isCurrencyCode(null)).toBe(false);
    expect(isCurrencyCode(123)).toBe(false);
  });
});

describe("isSplitRule", () => {
  it.each(["equal", "exact", "percent", "shares"])(
    "accepts split rule %s",
    (rule) => {
      expect(isSplitRule(rule)).toBe(true);
    },
  );

  it("rejects unsupported split rules", () => {
    expect(isSplitRule("random")).toBe(false);
    expect(isSplitRule("EQUAL")).toBe(false);
    expect(isSplitRule(null)).toBe(false);
  });
});

describe("isRail", () => {
  it.each(["tarus", "tarusqr", "pocket"])(
    "accepts payment rail %s",
    (rail) => {
      expect(isRail(rail)).toBe(true);
    },
  );

  it("rejects unsupported payment rails", () => {
    expect(isRail("cash")).toBe(false);
    expect(isRail("other")).toBe(false);
    expect(isRail(null)).toBe(false);
  });
});

describe("isGroupKind", () => {
  it.each(["trip", "dinner", "gift", "home", "other"])(
    "accepts group kind %s",
    (kind) => {
      expect(isGroupKind(kind)).toBe(true);
    },
  );

  it("rejects unsupported group kinds", () => {
    expect(isGroupKind("work")).toBe(false);
    expect(isGroupKind(null)).toBe(false);
  });
});

describe("isCategory", () => {
  it.each([
    "general",
    "food",
    "groceries",
    "transport",
    "stay",
    "gift",
    "activity",
  ])("accepts category %s", (category) => {
    expect(isCategory(category)).toBe(true);
  });

  it("rejects unsupported categories", () => {
    expect(isCategory("entertainment")).toBe(false);
    expect(isCategory(null)).toBe(false);
  });
});

describe("imageDataUrl", () => {
  it.each([
    "data:image/png;base64,",
    "data:image/jpeg;base64,",
    "data:image/jpg;base64,",
    "data:image/webp;base64,",
    "data:image/gif;base64,",
  ])("accepts supported image MIME type: %s", (value) => {
    expect(imageDataUrl(value)).toBe(value);
  });

  it("accepts MIME types regardless of letter casing", () => {
    const value = "data:image/PNG;base64,";
    expect(imageDataUrl(value)).toBe(value);
  });

  it("rejects unsupported MIME types", () => {
    expect(imageDataUrl("data:image/svg+xml;base64,abc")).toBeNull();
    expect(imageDataUrl("data:application/pdf;base64,abc")).toBeNull();
    expect(imageDataUrl("data:text/plain;base64,abc")).toBeNull();
  });

  it("rejects malformed data URL prefixes", () => {
    expect(imageDataUrl("image/png;base64,abc")).toBeNull();
    expect(imageDataUrl("data:image/png,abc")).toBeNull();
    expect(imageDataUrl("")).toBeNull();
  });

  it("rejects non-string values", () => {
    expect(imageDataUrl(null)).toBeNull();
    expect(imageDataUrl(undefined)).toBeNull();
    expect(imageDataUrl(123)).toBeNull();
  });

  it("accepts values at the maximum character limit", () => {
    const value = "data:image/png;base64," + "a".repeat(100);
    expect(imageDataUrl(value, value.length)).toBe(value);
  });

  it("rejects values exceeding the maximum character limit", () => {
    const value = "data:image/png;base64," + "a".repeat(101);
    expect(imageDataUrl(value, 100)).toBeNull();
  });
});
