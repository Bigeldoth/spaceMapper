// Device UI regressions with mocked IPC; never opens native apps or joystick drivers.
// DEVICES_TEST_EDITION=lite|premium DEVICES_TEST_URL=http://127.0.0.1:1435
// Resolve Playwright through NODE_PATH; DEVICES_TEST_BROWSER may point to Chrome.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";
const { chromium } = createRequire(import.meta.url)("playwright");
const edition = process.env.DEVICES_TEST_EDITION ?? "premium";
const browser = await chromium.launch({ headless: true, executablePath: process.env.DEVICES_TEST_BROWSER });
const errors = [];
async function createPage(startFailure = false) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
  page.setDefaultTimeout(10000);
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(({ edition, startFailure }) => {
    // Shorten only the 3s discovery interval, including the old implementation.
    const timeout = window.setTimeout.bind(window);
    const interval = window.setInterval.bind(window);
    window.setTimeout = (callback, delay, ...args) => timeout(callback, delay === 3000 ? 40 : delay, ...args);
    window.setInterval = (callback, delay, ...args) => interval(callback, delay === 3000 ? 40 : delay, ...args);
    const device = { instance_guid: "qa-stick", product_name: "Device original", instance_name: "Device original", category: "joystick", axes: 4, buttons: 8, povs: 1 };
    const state = window.__deviceTest = {
      devices: [device], blockEnumeration: !startFailure, failEnumeration: startFailure,
      enumerationCalls: 0, enumerationActive: 0, maxEnumerationActive: 0,
      diagnostics: [], activeDiagnostics: 0, maxActiveDiagnostics: 0,
      session: 0, sequence: 0, polls: 0, movement: false,
      lifecycleActive: 0, maxLifecycleActive: 0,
    };
    let callback = 1;
    window.__TAURI_INTERNALS__ = {
      metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main", windowLabel: "main" } },
      transformCallback: () => callback++, unregisterCallback: () => {},
      invoke: async (command, args = {}) => {
        if (command === "get_settings") return { ui_language: "fr", game_language: "french", version: 1 };
        if (command === "list_devices") {
          state.enumerationCalls++;
          state.enumerationActive++;
          state.maxEnumerationActive = Math.max(state.maxEnumerationActive, state.enumerationActive);
          try {
            while (state.blockEnumeration) await new Promise(resolve => timeout(resolve, 10));
            if (state.failEnumeration) throw new Error("Test: pilote indisponible");
            return structuredClone(state.devices);
          } finally { state.enumerationActive--; }
        }
        if (command === "locate_actionmaps") return [{ channel: "LIVE", path: "C:/qa/actionmaps.xml" }];
        if (command === "build_info") return { edition, channel: "production", version: "0.1.0" };
        if (command === "list_editable_bindings") return { bindings: [], defaults_error: null, colliding_contexts: [] };
        if (command === "list_backups") return [];
        if (command === "diagnose_devices") {
          state.activeDiagnostics++;
          state.maxActiveDiagnostics = Math.max(state.maxActiveDiagnostics, state.activeDiagnostics);
          const snapshot = structuredClone(state.devices);
          return new Promise((resolve, reject) => {
            state.diagnostics.push({ path: args.path, snapshot,
              finish: (name) => {
                state.activeDiagnostics--;
                resolve({ findings: [], slots: [], declared: [], live: snapshot.map((item, index) => ({ ...item, instance_name: name, product_guid: "qa-product", rank: index + 1, declared_in_file: true })) });
              },
              fail: () => { state.activeDiagnostics--; reject(new Error("Test: diagnostic interrompu")); },
            });
          });
        }
        if (command === "start_capture" || command === "stop_capture") {
          state.lifecycleActive++;
          state.maxLifecycleActive = Math.max(state.maxLifecycleActive, state.lifecycleActive);
          try {
            if (state.lifecycleActive > 1) throw new Error("Test: capture lifecycle busy");
            await new Promise(resolve => timeout(resolve, 20));
            return command === "start_capture" ? ++state.session : null;
          } finally { state.lifecycleActive--; }
        }
        if (command === "clear_capture") return ++state.sequence;
        if (command === "poll_live_capture" || command === "poll_capture") {
          state.polls++;
          const input = state.movement ? { guid: "qa-stick", control: "x", kind: "axis", value: 0.7, capturable: true, detected_sequence: state.sequence + 1 } : null;
          if (command === "poll_capture") return input;
          return { session_id: args.id, sequence: ++state.sequence, inputs: input ? [input] : [], last: input, capture_ready: true };
        }
        if (command === "desktop_refresh_tray") return null;
        if (command === "joy_status" || command === "joy_resume") return { running: false, profileId: null, error: null };
        if (command === "plugin:event|listen") return args.handler;
        if (command.startsWith("plugin:")) return null;
        throw new Error(`Unmocked command ${command}`);
      },
    };
    window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
  }, { edition, startFailure });
  await page.goto(process.env.DEVICES_TEST_URL ?? "http://127.0.0.1:1435");
  return page;
}
let page;
try {
  page = await createPage();
  await page.waitForFunction(() => window.__deviceTest.enumerationActive === 1);
  await page.waitForTimeout(180);
  assert.equal(await page.evaluate(() => window.__deviceTest.enumerationCalls), 1, "Hung startup scan is shared with periodic discovery and StrictMode remount");
  await page.evaluate(() => { window.__deviceTest.blockEnumeration = false; });
  await page.getByRole("navigation").getByRole("button", { name: "Périphériques", exact: true }).click();
  await page.waitForFunction(() => window.__deviceTest.diagnostics.length === 1);
  const refreshing = page.getByRole("status").filter({ hasText: "Diagnostic des périphériques en cours…" });
  await refreshing.waitFor();
  const refresh = page.getByRole("button", { name: "Actualiser", exact: true });
  assert.equal(await refresh.isDisabled(), true);
  await page.evaluate(() => {
    window.__deviceTest.movement = true;
    window.__deviceTest.devices[0].product_name = "Device changed";
  });
  await page.waitForTimeout(180);
  assert.equal(await page.evaluate(() => window.__deviceTest.diagnostics.length), 1, "Device changes queue without overlapping a hung diagnostic");
  assert.ok(await page.evaluate(() => window.__deviceTest.polls > 2), "Live capture continues during diagnostic wait");
  await page.evaluate(() => window.__deviceTest.diagnostics[0].finish("Obsolete report"));
  await page.waitForFunction(() => window.__deviceTest.diagnostics.length === 2);
  assert.equal(await page.getByText("Obsolete report", { exact: true }).count(), 0, "Stale device result is ignored");
  await page.evaluate(() => window.__deviceTest.diagnostics[1].finish("Current report"));
  await page.getByText("Current report", { exact: true }).waitFor();
  await refreshing.waitFor({ state: "hidden" });
  await refresh.click();
  await page.waitForFunction(() => window.__deviceTest.diagnostics.length === 3);
  assert.equal(await page.getByText("Current report", { exact: true }).count(), 1, "Refresh retains the last report for the same profile");
  await page.evaluate(() => window.__deviceTest.diagnostics[2].fail());
  await page.getByRole("alert").filter({ hasText: "Test: diagnostic interrompu" }).waitFor();
  await page.waitForTimeout(180);
  assert.equal(await page.evaluate(() => window.__deviceTest.diagnostics.length), 3, "Transient error alone causes no retry loop");
  assert.equal(await page.getByText("Current report", { exact: true }).count(), 1);
  await refresh.click();
  await page.waitForFunction(() => window.__deviceTest.diagnostics.length === 4);
  await page.evaluate(() => window.__deviceTest.diagnostics[3].finish("Retried report"));
  await page.getByText("Retried report", { exact: true }).waitFor();
  await page.getByRole("alert").filter({ hasText: "Test: diagnostic interrompu" }).waitFor({ state: "hidden" });
  await refresh.click();
  await page.waitForFunction(() => window.__deviceTest.diagnostics.length === 5);
  await page.getByRole("navigation").getByRole("button", { name: "Commandes", exact: true }).click();
  await page.evaluate(() => window.__deviceTest.diagnostics[4].finish("Unmounted report"));
  assert.equal(await page.getByText("Unmounted report", { exact: true }).count(), 0);
  assert.equal(await page.evaluate(() => window.__deviceTest.maxEnumerationActive), 1);
  assert.equal(await page.evaluate(() => window.__deviceTest.maxActiveDiagnostics), 1);
  assert.equal(await page.evaluate(() => window.__deviceTest.maxLifecycleActive), 1, "Tab changes serialize asynchronous capture start/stop");
  await page.close();

  // A driver error must not discard independent discovery/profile/build results.
  page = await createPage(true);
  await page.getByRole("navigation").waitFor();
  await page.getByRole("alert").filter({ hasText: "Test: pilote indisponible" }).waitFor();
  await page.getByRole("navigation").getByRole("button", { name: "Périphériques", exact: true }).click();
  await page.waitForFunction(() => window.__deviceTest.diagnostics.length === 1);
  assert.equal(await page.evaluate(() => window.__deviceTest.diagnostics[0].path), "C:/qa/actionmaps.xml", "Profile remains selected despite a driver failure");
  assert.equal(await page.getByRole("banner").getByText("LIVE", { exact: true }).count(), 1);
  await page.evaluate(() => { window.__deviceTest.failEnumeration = false; });
  await page.getByRole("alert").filter({ hasText: "Test: pilote indisponible" }).waitFor({ state: "hidden" });
  assert.deepEqual(errors, []);
  console.log(`PASS ${edition}: single in-flight discovery, hung/slow diagnostic status, stable movement, coalesced hardware refresh, stale result rejection, retained report, explicit error/retry, cleanup, independent bootstrap results and recovery.`);
} catch (error) {
  await mkdir("target/qa", { recursive: true });
  if (page && !page.isClosed()) {
    await page.screenshot({ path: `target/qa/devices-${edition}-failure.png` });
    console.error((await page.locator("body").innerText()).slice(-5000));
  }
  console.error(errors);
  throw error;
} finally { await browser.close(); }
