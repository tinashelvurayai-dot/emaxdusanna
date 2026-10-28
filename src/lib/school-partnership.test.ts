import { describe, expect, test } from "bun:test";
import { PARTNERSHIP_VISIT, validatePartnershipInput } from "./school-partnership";
const schoolId = "12345678-1234-1234-1234-123456789abc";
describe("school partnership requirements", () => {
  test("two representatives visit the school", () => { expect(PARTNERSHIP_VISIT.representatives).toBe(2); });
  test("the discussion lasts ten minutes", () => { expect(PARTNERSHIP_VISIT.discussionMinutes).toBe(10); });
  test("admin records acceptance by ticking", () => { expect(validatePartnershipInput({ schoolId, field: "terms_accepted", checked: true }).checked).toBe(true); });
  test("admin records non-acceptance by unticking", () => { expect(validatePartnershipInput({ schoolId, field: "terms_accepted", checked: false }).checked).toBe(false); });
  test("invalid fields and non-boolean updates are rejected", () => {
    expect(() => validatePartnershipInput({ schoolId, field: "role" as never, checked: true })).toThrow();
    expect(() => validatePartnershipInput({ schoolId, field: "terms_accepted", checked: "true" as never })).toThrow();
  });
});