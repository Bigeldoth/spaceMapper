import test from "node:test";
import assert from "node:assert/strict";
import { createCaptureLifecycleQueue } from "../src/lib/captureLifecycleQueue.ts";

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

test("tab lifecycle calls wait for the previous operation, preserve order and results", async () => {
  const enqueue = createCaptureLifecycleQueue();
  const first = deferred();
  const stop = deferred();
  const calls = [];
  const started = enqueue(() => { calls.push("start 1"); return first.promise; });
  const stopped = enqueue(() => { calls.push("stop 1"); return stop.promise; });
  const next = enqueue(async () => { calls.push("start 2"); return 2; });
  await Promise.resolve();
  assert.deepEqual(calls, ["start 1"]);
  first.resolve(1);
  assert.equal(await started, 1);
  await Promise.resolve();
  assert.deepEqual(calls, ["start 1", "stop 1"]);
  stop.resolve();
  await stopped;
  assert.equal(await next, 2);
  assert.deepEqual(calls, ["start 1", "stop 1", "start 2"]);
});

test("a rejected native operation does not poison later lifecycle calls", async () => {
  const enqueue = createCaptureLifecycleQueue();
  const reason = new Error("driver timeout");
  const failed = enqueue(async () => { throw reason; });
  const next = enqueue(async () => "recovered");
  await assert.rejects(failed, error => error === reason);
  assert.equal(await next, "recovered");
});

test("late cleanup keeps its session id and never runs concurrently with a newer start", async () => {
  const enqueue = createCaptureLifecycleQueue();
  const first = deferred();
  const second = deferred();
  const calls = [];
  const started = enqueue(() => { calls.push("start 1"); return first.promise; });
  const cleanup = started.then(id => enqueue(async () => { calls.push(`stop ${id}`); }));
  const newer = enqueue(() => { calls.push("start 2"); return second.promise; });
  first.resolve(41);
  await started;
  await Promise.resolve();
  assert.deepEqual(calls, ["start 1", "start 2"]);
  second.resolve(42);
  assert.equal(await newer, 42);
  await cleanup;
  assert.deepEqual(calls, ["start 1", "start 2", "stop 41"]);
});
