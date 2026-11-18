import { describe, expect, it } from "vitest";
import {
  confirmationProgress,
  requiredConfirmers,
  resolveExpenseStatus,
} from "./confirmation";

describe("requiredConfirmers", () => {
  it("asks the payer and every split member except the author", () => {
    expect(
      requiredConfirmers({ createdBy: "a", paidBy: "a", participantIds: ["a", "b", "c"] }),
    ).toEqual(["b", "c"]);
  });
  it("needs the payer's yes when the author names someone else as payer", () => {
    expect(
      requiredConfirmers({ createdBy: "a", paidBy: "d", participantIds: ["a"] }),
    ).toEqual(["d"]);
  });
  it("needs nobody when the expense only touches the author", () => {
    expect(
      requiredConfirmers({ createdBy: "a", paidBy: "a", participantIds: ["a"] }),
    ).toEqual([]);
  });
  it("does not list anyone twice", () => {
    expect(
      requiredConfirmers({ createdBy: "a", paidBy: "b", participantIds: ["b", "c", "c"] }),
    ).toEqual(["b", "c"]);
  });
});

describe("resolveExpenseStatus", () => {
  it("stays pending until everyone has said yes", () => {
    expect(resolveExpenseStatus(["confirmed", "pending"])).toBe("pending");
  });
  it("is confirmed when all said yes", () => {
    expect(resolveExpenseStatus(["confirmed", "confirmed"])).toBe("confirmed");
  });
  it("is rejected as soon as one says no", () => {
    expect(resolveExpenseStatus(["confirmed", "rejected", "pending"])).toBe("rejected");
  });
  it("is confirmed with no confirmers", () => {
    expect(resolveExpenseStatus([])).toBe("confirmed");
  });
});

describe("confirmationProgress", () => {
  it("counts confirmed out of total", () => {
    expect(confirmationProgress(["confirmed", "pending", "confirmed"])).toEqual({
      confirmed: 2,
      total: 3,
    });
  });
});
