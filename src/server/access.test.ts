import { test } from "node:test";
import assert from "node:assert/strict";
import { canSeeJob, isAccountKey, slideAccess } from "./access";

const A = "u:aaaaaaaa-1111";
const B = "u:bbbbbbbb-2222";

test("a deck job of account A is visible to A only", () => {
  const job = { ownerKey: A, userId: "aaaaaaaa-1111" };
  assert.equal(canSeeJob(job, A), true);
  assert.equal(canSeeJob(job, B), false, "another signed-in account");
  assert.equal(canSeeJob(job, "c:some-browser-key"), false, "anonymous browser");
  assert.equal(canSeeJob(job, "ip:1.2.3.4"), false, "anonymous by IP");
});

test("account ownership is read from userId even if the owner key is odd", () => {
  assert.equal(canSeeJob({ ownerKey: "c:legacy", userId: "aaaaaaaa-1111" }, A), true);
  assert.equal(canSeeJob({ ownerKey: "c:legacy", userId: "aaaaaaaa-1111" }, B), false);
  assert.equal(canSeeJob({ ownerKey: "c:legacy", userId: "aaaaaaaa-1111" }, "c:legacy"), false);
});

test("a signed stream link opens the progress stream of an account's job (EventSource has no login header)", () => {
  assert.equal(canSeeJob({ ownerKey: A, userId: "aaaaaaaa-1111" }, "ip:9.9.9.9", true), true);
});

test("anonymous jobs stay readable by their link", () => {
  assert.equal(canSeeJob({ ownerKey: "c:browser-1" }, "c:browser-2"), true);
  assert.equal(canSeeJob({ ownerKey: "ip:1.2.3.4" }, B), true);
});

test("isAccountKey", () => {
  assert.equal(isAccountKey(A), true);
  assert.equal(isAccountKey("c:x"), false);
  assert.equal(isAccountKey(undefined), false);
});

test("slide HTML needs the owner's signed link", () => {
  // payments off (beta): the owner's deck page hands out a link; nobody else gets the slide
  assert.equal(slideAccess({ isPublic: false, deckOwnerKey: A, scope: null, paymentsOn: false }), "forbidden");
  assert.equal(slideAccess({ isPublic: false, deckOwnerKey: A, scope: "full", paymentsOn: false }), "ok");
  assert.equal(slideAccess({ isPublic: false, deckOwnerKey: A, scope: "view", paymentsOn: false }), "ok");
  assert.equal(slideAccess({ isPublic: false, deckOwnerKey: "c:browser", scope: null, paymentsOn: false }), "forbidden");
  // payments on: preview link is not enough for the live slide
  assert.equal(slideAccess({ isPublic: false, deckOwnerKey: A, scope: "view", paymentsOn: true }), "locked");
  assert.equal(slideAccess({ isPublic: false, deckOwnerKey: A, scope: null, paymentsOn: true }), "forbidden");
  assert.equal(slideAccess({ isPublic: false, deckOwnerKey: A, scope: "full", paymentsOn: true }), "ok");
  // gallery samples
  assert.equal(slideAccess({ isPublic: true, deckOwnerKey: A, scope: null, paymentsOn: true }), "ok");
  assert.equal(slideAccess({ isPublic: false, deckOwnerKey: undefined, scope: null, paymentsOn: false }), "ok");
});
