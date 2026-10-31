import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { setActiveJobs, keepAliveState, keepAliveUrl, keepAliveIntervalMs } from "./keepAlive";

function fakeTimers() {
  const t = { started: 0, cleared: 0, ms: 0, fn: null as null | (() => void) };
  return {
    t,
    deps: {
      setIntervalImpl: ((fn: () => void, ms: number) => { t.started++; t.ms = ms; t.fn = fn; return { unref() {} } as any; }) as any,
      clearIntervalImpl: (() => { t.cleared++; }) as any,
      fetchImpl: (async () => new Response("{}", { status: 200 })) as any,
    },
  };
}

beforeEach(() => {
  const f = fakeTimers();
  setActiveJobs(0, f.deps); // stop any timer left by a previous test
  delete process.env.KEEPALIVE;
  delete process.env.KEEPALIVE_INTERVAL_MIN;
  process.env.PUBLIC_SITE_URL = "https://deckcraft-test.onrender.com/";
});

test("keep-alive pings only while a job is active", async () => {
  const { t, deps } = fakeTimers();
  assert.equal(keepAliveUrl(), "https://deckcraft-test.onrender.com/api/health?keepalive=1");
  setActiveJobs(1, deps);
  assert.equal(t.started, 1);
  assert.equal(t.ms, 4 * 60_000);
  setActiveJobs(2, deps); // still one timer
  assert.equal(t.started, 1);
  t.fn?.();
  await new Promise((r) => setTimeout(r, 10));
  assert.equal(keepAliveState().pings >= 1, true);
  setActiveJobs(0, deps);
  assert.equal(t.cleared, 1);
  assert.equal(keepAliveState().on, false);
});

test("no PUBLIC_SITE_URL or KEEPALIVE=off: never starts", () => {
  const { t, deps } = fakeTimers();
  delete process.env.PUBLIC_SITE_URL;
  setActiveJobs(1, deps);
  assert.equal(t.started, 0);
  process.env.PUBLIC_SITE_URL = "https://x.onrender.com";
  process.env.KEEPALIVE = "off";
  setActiveJobs(1, deps);
  assert.equal(t.started, 0);
  setActiveJobs(0, deps);
});

test("interval is clamped below Render's 15-minute idle limit", () => {
  process.env.KEEPALIVE_INTERVAL_MIN = "30";
  assert.equal(keepAliveIntervalMs(), 14 * 60_000);
  process.env.KEEPALIVE_INTERVAL_MIN = "0";
  assert.equal(keepAliveIntervalMs(), 60_000);
});
