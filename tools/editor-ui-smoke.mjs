// Run against either edition's Vite server. IPC is mocked: no game files or OS input.
// EDITOR_TEST_EDITION=lite|premium EDITOR_TEST_URL=http://127.0.0.1:1434
// Resolve Playwright through NODE_PATH; optionally set EDITOR_TEST_BROWSER.
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import { mkdir } from "node:fs/promises";

const { chromium } = createRequire(import.meta.url)("playwright");
const edition = process.env.EDITOR_TEST_EDITION ?? "lite";
const browser = await chromium.launch({ headless: true, executablePath: process.env.EDITOR_TEST_BROWSER });
const page = await browser.newPage({ viewport: { width: 1280, height: 700 } });
page.setDefaultTimeout(10000);
const errors = [];
page.on("pageerror", error => errors.push(error.message));
page.on("console", message => { if (message.type() === "error") console.error(message.text()); });
page.on("requestfailed", request => console.error(request.url(), request.failure()));
await page.addInitScript(edition => {
  const state = window.__editorTest = {
    saved: [], backupActions: [], sequence: 0, session: 0,
    bindings: Array.from({ length: 80 }, (_, index) => ({
      actionmap: "spaceship_movement", action: `regression_${index}`, label: `Regression ${String(index).padStart(2, "0")}`,
      description: null, context: "ship_seat", category: "movement", access: "editable", lock: null,
      origin: "override", input_raw: "kb1_f", device: "kb1", control: "f", modifier: null, activation_mode: "press", multi_tap: "1",
    })),
  };
  let callback = 1;
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: "main" }, currentWebview: { label: "main", windowLabel: "main" } },
    transformCallback: () => callback++, unregisterCallback: () => {},
    invoke: async (command, args = {}) => {
      if (command === "get_settings") return { ui_language: "fr", game_language: "french", version: 1 };
      if (command === "list_devices") return [];
      if (command === "locate_actionmaps") return [{ channel: "LIVE", path: "C:/test/actionmaps.xml" }];
      if (command === "build_info") return { edition, version: "0.1.0", channel: "test" };
      if (command === "list_editable_bindings") return { bindings: structuredClone(state.bindings), defaults_error: null, colliding_contexts: [["ship_seat", "ship_seat"]] };
      if (command === "list_backups") return Array.from({ length: 50 }, (_, index) => ({ path: `C:/test/backup-${index}.xml`, timestamp: String(1788900000000 - index * 60000) }));
      if (command === "restore_backup" || command === "delete_backup") { state.backupActions.push(command); return null; }
      if (command === "save_bindings") {
        state.saved.push(structuredClone(args.edits));
        for (const edit of args.edits) {
          const binding = state.bindings.find(item => item.action === edit.action && item.input_raw === edit.original_input);
          if (!binding) throw new Error("Wrong original input");
          binding.input_raw = edit.input;
          binding.device = edit.input?.split("_")[0] ?? null;
          const control = edit.input?.split("_")[1] ?? "";
          const pieces = control.split("+");
          binding.control = pieces.at(-1); binding.modifier = pieces.length > 1 ? pieces[0] : null;
        }
        return null;
      }
      if (command === "joy_status" || command === "joy_resume") return { running: false, profileId: null, error: null };
      if (command === "desktop_refresh_tray" || command === "stop_capture") return null;
      if (command === "start_capture") return ++state.session;
      if (command === "clear_capture") return ++state.sequence;
      if (command === "poll_live_capture") return { session_id: args.id, sequence: ++state.sequence, capture_ready: true, last: null, inputs: [] };
      if (command === "plugin:event|listen") return args.handler;
      if (command.startsWith("plugin:")) return null;
      throw new Error(`Unmocked command: ${command}`);
    },
  };
  window.__TAURI_EVENT_PLUGIN_INTERNALS__ = { unregisterListener: () => {} };
}, edition);

const dialog = page.locator('[role="dialog"][aria-modal="true"]');
async function bounds() {
  const overlay = await dialog.locator("..").boundingBox();
  const box = await dialog.boundingBox();
  const viewport = page.viewportSize();
  assert.deepEqual(overlay, { x: 0, y: 0, width: viewport.width, height: viewport.height });
  assert.ok(box.x >= 0 && box.x + box.width <= viewport.width && box.y >= 0 && box.y + box.height <= viewport.height, "Dialog fits the viewport");
  assert.equal(await dialog.evaluate(element => element.scrollWidth > element.clientWidth), false, "No horizontal overflow");
  assert.equal(await dialog.evaluate(element => element.parentElement.parentElement === document.body), true, "Modal is portaled outside the long app view");
}
async function openEditor() {
  await page.getByRole("button").filter({ has: page.getByText("Regression 00", { exact: true }) }).first().click();
  await page.getByRole("button", { name: "Modifier", exact: true }).click();
  await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "button");
}
async function commitSelection(token, count) {
  const next = dialog.getByRole("button", { name: edition === "premium" ? "Continuer" : "Appliquer", exact: true });
  await next.focus();
  await page.keyboard.press("Enter");
  if (edition === "premium") await dialog.getByRole("button", { name: "Appliquer", exact: true }).click();
  await page.getByRole("button", { name: "Enregistrer…", exact: true }).click();
  await bounds();
  await dialog.getByRole("button", { name: "Enregistrer", exact: true }).click();
  await page.waitForFunction(count => window.__editorTest.saved.length === count, count);
  assert.equal(await page.evaluate(() => window.__editorTest.saved.at(-1)[0].input), token);
}

try {
  await page.goto(process.env.EDITOR_TEST_URL ?? "http://127.0.0.1:1434");
  await page.getByRole("searchbox", { name: /Rechercher/ }).fill("Regression");
  await openEditor();
  await bounds();
  assert.ok(await page.locator(".app-view").evaluate(element => element.scrollHeight > 2000), "Fixture reproduces a long command list");
  await page.waitForFunction(() => getComputedStyle(document.querySelector(".app-view")).transform === "none");
  await page.keyboard.press("Tab");
  assert.equal(await dialog.getByRole("combobox", { name: "Modificateur", exact: true }).evaluate(element => element === document.activeElement), true, "Tab leaves capture without assigning");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "hidden" });
  assert.equal(await page.getByRole("button", { name: "Modifier", exact: true }).evaluate(element => element === document.activeElement), true, "Cancel restores focus");

  let count = 0;
  for (const [key, modifier, token] of [["Tab", "", "kb1_tab"], ["Escape", "", "kb1_escape"], ["Tab", "rshift", "kb1_rshift+tab"], ["Escape", "lctrl", "kb1_lctrl+escape"]]) {
    await openEditor();
    await page.setViewportSize({ width: 400, height: 420 });
    await bounds();
    await dialog.getByRole("combobox", { name: "Modificateur", exact: true }).selectOption(modifier);
    await dialog.getByRole("combobox", { name: "Touche", exact: true }).selectOption(key);
    await dialog.getByText(token, { exact: true }).waitFor();
    await commitSelection(token, ++count);
    await page.setViewportSize({ width: 1280, height: 700 });
  }
  await openEditor();
  await page.keyboard.press("KeyG");
  await commitSelection("kb1_g", ++count);

  for (const action of ["Restaurer", "Supprimer"]) {
    await page.getByRole("button", { name: /^Points de restauration: 50/ }).click();
    const trigger = page.getByRole("dialog").getByRole("button", { name: action, exact: true }).first();
    await trigger.click();
    await page.setViewportSize({ width: 400, height: 420 });
    await bounds();
    const cancel = dialog.getByRole("button", { name: "Annuler", exact: true });
    assert.equal(await cancel.evaluate(element => element === document.activeElement), true, "Confirmation focuses cancel");
    await page.keyboard.press("Shift+Tab");
    assert.equal(await dialog.getByRole("button", { name: action, exact: true }).evaluate(element => element === document.activeElement), true, "Focus stays in confirmation");
    await page.keyboard.press("Tab");
    assert.equal(await cancel.evaluate(element => element === document.activeElement), true);
    await page.keyboard.press("Escape");
    await dialog.waitFor({ state: "hidden" });
    assert.equal(await trigger.evaluate(element => element === document.activeElement), true, "Confirmation restores trigger focus");
    assert.equal(await page.evaluate(() => window.__editorTest.backupActions.length), 0, "Cancel never invokes restore/delete");
    await page.setViewportSize({ width: 1280, height: 700 });
    await page.mouse.click(5, 650);
  }
  assert.deepEqual(errors, []);
  console.log(`PASS ${edition}: long lists, 400x420 dialogs, Tab/Escape and left/right modifiers saved, ordinary capture, keyboard apply/cancel, restore/delete focus traps.`);
} catch (error) {
  await mkdir("target/qa", { recursive: true });
  await page.screenshot({ path: `target/qa/editor-${edition}-failure.png` });
  console.error((await page.locator("body").innerText()).slice(-6000));
  console.error("Page errors:", errors);
  throw error;
} finally {
  await browser.close();
}
