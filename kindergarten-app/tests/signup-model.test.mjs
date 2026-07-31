import assert from "node:assert/strict";
import test from "node:test";

import {
  DEMO_PHONE_CODE,
  formatUsPhoneInput,
  getLegalAuthorityLabel,
  getRelationshipLabel,
  isStructurallyValidUsPhone,
  toUsE164,
} from "../src/signupModel.ts";

test("formats common U.S. phone inputs consistently", () => {
  assert.equal(formatUsPhoneInput("7145550123"), "(714) 555-0123");
  assert.equal(formatUsPhoneInput("(714) 555-0123"), "(714) 555-0123");
  assert.equal(formatUsPhoneInput("+1 714-555-0123"), "(714) 555-0123");
});

test("normalizes structurally valid U.S. numbers to E.164", () => {
  assert.equal(isStructurallyValidUsPhone("(714) 555-0123"), true);
  assert.equal(toUsE164("(714) 555-0123"), "+17145550123");
});

test("rejects non-NANP and incomplete phone shapes", () => {
  assert.equal(isStructurallyValidUsPhone("010-1234-5678"), false);
  assert.equal(isStructurallyValidUsPhone("(114) 555-0123"), false);
  assert.equal(isStructurallyValidUsPhone("(714) 155-0123"), false);
  assert.equal(isStructurallyValidUsPhone("714-555-012"), false);
  assert.equal(toUsE164("010-1234-5678"), null);
});

test("keeps relationship and legal authority labels separate", () => {
  assert.equal(getRelationshipLabel("mother", ""), "어머니");
  assert.equal(getRelationshipLabel("other", "이모"), "이모");
  assert.equal(getLegalAuthorityLabel("unsure"), "잘 모르겠어요");
});

test("uses an explicitly demo-only six digit screen code", () => {
  assert.match(DEMO_PHONE_CODE, /^\d{6}$/);
});
