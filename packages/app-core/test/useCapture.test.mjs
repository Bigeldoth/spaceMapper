import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const source = ts.transpileModule(
  readFileSync(new URL("../src/useCapture.ts", import.meta.url), "utf8"),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } },
).outputText;

const settle = () => new Promise(resolve => setImmediate(resolve));

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
}

// Execute the real hook with controlled React effects, IPC and timers so native
// responses can arrive in the order that previously caused capture races.
function mountCapture() {
  const slots = [];
  const effects = [];
  const timers = new Map();
  const desktopListeners = new Map();
  const starts = [];
  const clears = [];
  const polls = [];
  const stops = [];
  let cursor = 0;
  let nextTimer = 0;
  let devices = [{ instance_guid: "device-1" }];
  const react = {
    useState(initial) {
      const slot = cursor++;
      if (!(slot in slots)) slots[slot] = typeof initial === "function" ? initial() : initial;
      return [slots[slot], value => {
        slots[slot] = typeof value === "function" ? value(slots[slot]) : value;
      }];
    },
    useRef(initial) {
      const slot = cursor++;
      slots[slot] ??= { current: initial };
      return slots[slot];
    },
    useCallback(callback) { return callback; },
    useEffect(effect, dependencies) {
      const slot = cursor++;
      const previous = slots[slot];
      if (!previous || dependencies.some((value, index) => !Object.is(value, previous.dependencies[index]))) {
        slots[slot] = { dependencies, cleanup: previous?.cleanup };
        effects.push(() => {
          slots[slot].cleanup?.();
          slots[slot].cleanup = effect();
        });
      }
    },
  };
  const api = {
    startCapture(guids) {
      const result = { ...deferred(), guids };
      starts.push(result);
      return result.promise;
    },
    clearCapture() {
      const result = deferred();
      clears.push(result);
      return result.promise;
    },
    pollLiveCapture(id) {
      const result = { ...deferred(), id };
      polls.push(result);
      return result.promise;
    },
    stopCapture(id) { stops.push(id); return Promise.resolve(); },
  };
  const exports = {};
  runInNewContext(source, {
    exports,
    require(name) {
      if (name === "react") return react;
      if (name === "./lib/api") return { api };
      throw new Error(`Unexpected import: ${name}`);
    },
    document: { hidden: false, addEventListener() {}, removeEventListener() {} },
    window: {
      addEventListener(name, listener) { desktopListeners.set(name, listener); },
      removeEventListener(name) { desktopListeners.delete(name); },
      setTimeout(callback) { const id = ++nextTimer; timers.set(id, callback); return id; },
      clearTimeout(id) { timers.delete(id); },
    },
  });
  function render() {
    cursor = 0;
    const feed = exports.useCapture(devices, true);
    if (effects.length) {
      effects.splice(0).forEach(effect => effect());
      return render();
    }
    return feed;
  }
  render();
  return {
    starts, clears, polls, stops, render,
    replaceDevice(guid) { devices = [{ instance_guid: guid }]; return render(); },
    setVisible(visible) {
      desktopListeners.get("spacemapper:visibility")({ detail: visible });
      return render();
    },
    tick() {
      const [id, callback] = timers.entries().next().value;
      timers.delete(id);
      void callback();
    },
  };
}

function frame(id, sequence, control = "button5") {
  const last = { guid: "device-1", control, detected_sequence: sequence };
  return {
    session_id: id, sequence, capture_ready: true, last,
    inputs: [{ guid: last.guid, control, kind: "button", value: 1, capturable: true }],
  };
}

test("resets wait for startup, run in order and preserve each native barrier", async () => {
  const hook = mountCapture();
  const firstReset = hook.render().reset();
  const secondReset = hook.render().reset();
  await settle();
  assert.equal(hook.clears.length, 0);

  hook.starts[0].resolve(7);
  await settle();
  assert.equal(hook.clears.length, 1);
  assert.equal(hook.polls.length, 0);
  hook.clears[0].resolve(11);
  assert.equal(await firstReset, 11);
  await settle();
  assert.equal(hook.clears.length, 2);
  hook.tick();
  assert.equal(hook.polls.length, 0);

  hook.clears[1].resolve(12);
  assert.equal(await secondReset, 12);
  hook.tick();
  assert.equal(hook.polls.length, 1);
  hook.polls[0].resolve(frame(7, 13));
  await settle();
  assert.equal(hook.render().last.control, "button5");
  assert.equal(hook.render().frameSequence, 13);
  assert.equal(hook.render().active.length, 1);
  assert.equal(hook.render().captureReady, true);
});

test("an in-flight frame cannot undo reset and the barrier sequence can be republished", async () => {
  const hook = mountCapture();
  hook.starts[0].resolve(7);
  await settle();
  hook.polls[0].resolve(frame(7, 8));
  await settle();
  hook.tick();
  const reset = hook.render().reset();
  await settle();
  hook.polls[1].resolve(frame(7, 9, "stale-button"));
  await settle();
  assert.equal(hook.render().last, null);
  assert.equal(hook.render().active.length, 0);

  hook.clears[0].resolve(8);
  assert.equal(await reset, 8);
  hook.tick();
  hook.polls[2].resolve(frame(7, 8, "new-button"));
  await settle();
  assert.equal(hook.render().last.control, "new-button");
  assert.equal(hook.render().frameSequence, 8);
  assert.equal(hook.render().captureReady, true);
});

test("a reset from an obsolete startup cannot clear its replacement and hiding stops capture", async () => {
  const hook = mountCapture();
  const reset = hook.render().reset();
  hook.replaceDevice("device-2");
  hook.starts[1].resolve(8);
  await settle();
  hook.polls[0].resolve(frame(8, 1));
  await settle();
  hook.starts[0].resolve(7);
  assert.equal(await reset, null);
  await settle();
  assert.equal(hook.clears.length, 0);
  assert.equal(hook.render().last.control, "button5");
  assert.deepEqual(hook.stops, [7]);

  const hidden = hook.setVisible(false);
  await settle();
  assert.equal(hidden.listening, false);
  assert.equal(hidden.last, null);
  assert.equal(hidden.active.length, 0);
  assert.deepEqual(hook.stops, [7, 8]);
  hook.setVisible(true);
  assert.equal(hook.starts.length, 3);
});
