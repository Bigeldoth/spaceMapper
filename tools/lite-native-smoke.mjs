// Windows release smoke using the actual Lite executable and WebView2.
// APPDATA and WebView2 data are isolated. No game profile writes or OS remapping.
// NODE_PATH=<Playwright directory> node tools/lite-native-smoke.mjs
import { createRequire } from "node:module";
import { spawn, execFileSync } from "node:child_process";
import { mkdir, mkdtemp, writeFile, readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createServer } from "node:net";
import { resolve, join } from "node:path";
import assert from "node:assert/strict";

const { chromium } = createRequire(import.meta.url)("playwright");
const ps = process.env.PWSH_PATH ?? "powershell.exe";
const executable = resolve(process.env.LITE_TEST_EXE ?? "target/release/spacemapper-lite.exe");
const port = 9235;
const running = execFileSync(ps, ["-NoProfile", "-Command", "@(Get-Process spacemapper-lite -ErrorAction SilentlyContinue).Count"], { windowsHide: true, encoding: "utf8" });
assert.equal(Number(running.trim()), 0, "Close SpaceMapper Lite before this isolated release test");
// Do not accidentally attach to another application's debugging session.
await new Promise((resolvePort, reject) => {
  const probe = createServer();
  probe.once("error", reject);
  probe.listen(port, "127.0.0.1", () => probe.close(resolvePort));
});
const executableSha256 = createHash("sha256").update(await readFile(executable)).digest("hex");
await mkdir("target/qa", { recursive: true });
const sandbox = await mkdtemp(resolve("target/qa/lite-native-"));
for (const name of ["SpaceMapper", "SpaceMapper-Staging"]) {
  await mkdir(join(sandbox, name));
  await writeFile(join(sandbox, name, "settings.json"), JSON.stringify({ ui_language: "fr", game_language: "french_(france)", version: 1 }));
}
const env = { ...process.env, APPDATA: sandbox, WEBVIEW2_USER_DATA_FOLDER: join(sandbox, "webview"),
  WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}` };
const child = spawn(executable, [], { env, windowsHide: true, stdio: "ignore" });
let launchError;
child.once("error", error => { launchError = error; });
const exit = new Promise(resolveExit => child.once("exit", code => resolveExit(code)));
let browser;
let page;
try {
  let endpointReady = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (launchError) throw launchError;
    assert.equal(child.exitCode, null, "Lite exited during startup");
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(500) });
      if (response.ok) { endpointReady = true; break; }
    } catch {}
    await new Promise(resolveWait => setTimeout(resolveWait, 150));
  }
  assert.ok(endpointReady, "Isolated WebView2 debug endpoint started");
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  page = browser.contexts()[0]?.pages()[0];
  assert.ok(page, "Native Lite WebView2 page exists");
  page.setDefaultTimeout(15000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.waitForFunction(() => typeof window.__TAURI_INTERNALS__?.invoke === "function");
  assert.match(page.url(), /^(?:tauri:\/\/localhost|https?:\/\/tauri\.localhost)(?:\/|$)/, "Release serves embedded frontend, not Vite devUrl");
  const info = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke("build_info"));
  assert.equal(info.edition, "lite", "Test is attached to the Lite executable");
  const header = page.getByRole("banner", { name: "SpaceMapper Lite", exact: true });
  await header.waitFor();
  assert.ok((await header.innerText()).includes("SpaceMapper"));
  assert.ok((await header.innerText()).includes("Lite"));
  assert.equal(await page.getByRole("navigation").getByRole("button", { name: "Remappeur", exact: true }).count(), 0, "Lite does not expose a remapper tab");
  const ipc = await page.evaluate(async () => {
    const result = {};
    for (const [command, args] of [
      ["joy_start", { profileId: "qa-missing-never-created", deviceGuids: [] }],
      ["joy_sample_axis", { deviceGuid: "B10A044F-0000-0000-0000-504944564944", axis: "x", kind: "centered", step: 3 }],
    ]) {
      try { await window.__TAURI_INTERNALS__.invoke(command, args); result[command] = null; }
      catch (error) { result[command] = String(error); }
    }
    return result;
  });
  assert.match(ipc.joy_start, /command\s+joy_start\s+not found/i, "Lite has no remapper start command");
  assert.match(ipc.joy_sample_axis, /command\s+joy_sample_axis\s+not found/i, "Lite has no calibration command");

  // The assistant teaser needs no profile and exercises the real bundled upsell.
  await page.getByRole("navigation").getByRole("button", { name: "Assistant", exact: true }).click();
  const discover = page.getByRole("button", { name: /Découvrir l'assistant/ });
  await discover.click();
  const dialog = page.getByRole("dialog", { name: "Réservé à l'édition Premium", exact: true });
  await dialog.waitFor();
  const upsell = await dialog.innerText();
  assert.match(upsell, /remappeur joystick vers clavier et souris/i);
  assert.doesNotMatch(upsell, /synchro/i, "Bundled upsell makes no synchronization promise");
  assert.equal(await dialog.evaluate(element => element.parentElement.parentElement === document.body), true);
  const bounds = await dialog.boundingBox();
  const viewport = await page.evaluate(() => ({ width: innerWidth, height: innerHeight }));
  assert.ok(bounds.x >= 0 && bounds.y >= 0 && bounds.x + bounds.width <= viewport.width && bounds.y + bounds.height <= viewport.height, "Native upsell fits the WebView");
  await page.screenshot({ path: "target/qa/lite-native-upsell.png" });
  await dialog.getByRole("button", { name: "Fermer", exact: true }).click();
  await dialog.waitFor({ state: "hidden" });
  assert.deepEqual(errors, []);
  await writeFile("target/qa/lite-native-result.json", JSON.stringify({ executable, executableSha256, sandbox, url: page.url(), info, ipc, upsell, errors }, null, 2));
  // Close only the process this test launched, as the native title-bar cross does.
  execFileSync(ps, ["-NoProfile", "-Command", `(Get-Process -Id ${child.pid}).CloseMainWindow()`], { windowsHide: true });
  assert.equal(await Promise.race([exit, new Promise(resolveWait => setTimeout(() => resolveWait("timeout"), 5000))]), 0, "Native Lite close exits normally");
  console.log(`PASS: real Lite release serves embedded UI (${info.version}), rejects joy_start/joy_sample_axis as commands not found, advertises Premium remapper without synchronization, native modal fits viewport, clean exit. Isolated data: ${sandbox}`);
} catch (error) {
  if (page && !page.isClosed()) await page.screenshot({ path: "target/qa/lite-native-failure.png" }).catch(() => {});
  throw error;
} finally {
  if (child.exitCode === null && child.pid) child.kill();
  await browser?.close().catch(() => {});
}
