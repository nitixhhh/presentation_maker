import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import * as S from "./store"; // touches localStorage only when called

// a minimal browser localStorage for node
const mem = new Map<string, string>();
(globalThis as any).localStorage = {
  getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
  setItem: (k: string, v: string) => void mem.set(k, String(v)),
  removeItem: (k: string) => void mem.delete(k),
  clear: () => mem.clear(),
};


const job = (id: string) => ({ id, topic: `topic ${id}`, createdAt: new Date().toISOString() });

beforeEach(() => {
  mem.clear();
  S.setJobsOwner(null);
});

test("each identity has its own list", () => {
  S.setJobsOwner("user-a");
  S.saveJob(job("a1"));
  S.saveJob(job("a2"));
  S.setJobsOwner("user-b");
  assert.deepEqual(S.savedJobs(), [], "account B sees nothing of A");
  S.saveJob(job("b1"));
  S.setJobsOwner(null);
  assert.deepEqual(S.savedJobs(), [], "signed out sees neither account");
  S.setJobsOwner("user-a");
  assert.deepEqual(S.savedJobs().map((j) => j.id), ["a2", "a1"]);
});

test("sign-out clears only that account's list", () => {
  S.setJobsOwner("user-a");
  S.saveJob(job("a1"));
  S.setJobsOwner(null);
  S.saveJob(job("anon1"));
  S.clearJobs(S.ownerScope("user-a"));
  S.setJobsOwner("user-a");
  assert.deepEqual(S.savedJobs(), []);
  S.setJobsOwner(null);
  assert.deepEqual(S.savedJobs().map((j) => j.id), ["anon1"]);
});

test("the old shared list moves to the signed-out list only, once", () => {
  mem.set("deckcraft.jobs.v1", JSON.stringify([job("old1"), job("old2")]));
  S.setJobsOwner("user-b");
  assert.deepEqual(S.savedJobs(), [], "a signed-in account never inherits the old shared list");
  assert.equal(mem.has("deckcraft.jobs.v1"), false);
  S.setJobsOwner(null);
  assert.deepEqual(S.savedJobs().map((j) => j.id), ["old1", "old2"]);
});

test("keepOnly drops ids the server no longer shows", () => {
  S.saveJob(job("x"));
  S.saveJob(job("y"));
  S.keepOnly(["y"]);
  assert.deepEqual(S.savedJobs().map((j) => j.id), ["y"]);
});

test("keys", () => {
  assert.equal(S.ownerScope(null), "anon");
  assert.equal(S.ownerScope("abc"), "u:abc");
  assert.equal(S.jobsKey("u:abc"), "deckcraft.jobs.v2.u:abc");
});
