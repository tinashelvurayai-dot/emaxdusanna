import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { PARTNERSHIP_VISIT, validatePartnershipInput } from "./school-partnership";
const schoolId = "12345678-1234-1234-1234-123456789abc";
describe("school partnership requirements", () => {
  test("two representatives visit the school", () => { assert.equal(PARTNERSHIP_VISIT.representatives, 2); });
  test("the discussion lasts ten minutes", () => { assert.equal(PARTNERSHIP_VISIT.discussionMinutes, 10); });
  test("admin records acceptance by ticking", () => { assert.equal(validatePartnershipInput({ schoolId, field: "terms_accepted", checked: true }).checked, true); });
  test("admin records non-acceptance by unticking", () => { assert.equal(validatePartnershipInput({ schoolId, field: "terms_accepted", checked: false }).checked, false); });
  test("invalid fields and non-boolean updates are rejected", () => {
    assert.throws(() => validatePartnershipInput({ schoolId, field: "role" as never, checked: true }));
    assert.throws(() => validatePartnershipInput({ schoolId, field: "terms_accepted", checked: "true" as never }));
  });
});