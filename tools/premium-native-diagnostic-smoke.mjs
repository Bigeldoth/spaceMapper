// Real Premium release smoke. Run only after the user instance has been closed.
// A copied executable, APPDATA and WebView2 directory belong to this test only.
// The game XML and the real review file are read-only and verified by hashes.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn, execFileSync } from 'node:child_process';
import { mkdir, mkdtemp, copyFile, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createServer } from 'node:net';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const premium = resolve(root, '../spaceMapper-premium');
const { chromium } = createRequire('C:/Users/patri/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/package.json')('playwright');
const executable = resolve(process.env.PREMIUM_TEST_EXE ?? join(premium, 'target/release/spacemapper-premium.exe'));
const profile = process.env.PREMIUM_TEST_PROFILE ?? 'C:/Program Files/Roberts Space Industries/StarCitizen/LIVE/user/client/0/Profiles/default/actionmaps.xml';
const reviews = join(process.env.APPDATA, 'SpaceMapper-Premium/conflict-reviews.json');
const powershell = process.env.PWSH_PATH ?? 'powershell.exe';
const running = execFileSync(powershell, ['-NoProfile', '-Command', '@(Get-Process spacemapper-premium -ErrorAction SilentlyContinue).Count'], { windowsHide: true, encoding: 'utf8' });
assert.equal(Number(running.trim()), 0, 'Close the user Premium instance before this isolated test; the test never closes it');
const port = await new Promise((resolvePort, reject) => {
  const probe = createServer(); probe.once('error', reject);
  probe.listen(0, '127.0.0.1', () => { const port = probe.address().port; probe.close(() => resolvePort(port)); });
});
const hash = async path => createHash('sha256').update(await readFile(path)).digest('hex');
const before = { profile: await hash(profile), reviews: await hash(reviews), executable: await hash(executable) };
const artifactRoot = join(premium, 'target/qa');
await mkdir(artifactRoot, { recursive: true });
const sandbox = await mkdtemp(join(artifactRoot, 'premium-diagnostic-native-'));
const appData = join(sandbox, 'appdata');
const appDir = join(appData, 'SpaceMapper-Premium');
await mkdir(appDir, { recursive: true });
await copyFile(reviews, join(appDir, 'conflict-reviews.json'));
await writeFile(join(appDir, 'settings.json'), JSON.stringify({ version: 1, ui_language: 'fr', game_language: 'french_(france)' }));
const copiedExecutable = join(sandbox, 'spacemapper-premium.exe');
await copyFile(executable, copiedExecutable);
const env = { ...process.env, APPDATA: appData, WEBVIEW2_USER_DATA_FOLDER: join(sandbox, 'webview'), WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS: `--remote-debugging-port=${port}` };
const child = spawn(copiedExecutable, [], { env, windowsHide: true, stdio: 'ignore' });
let launchError;
child.once('error', error => { launchError = error; });
const exited = new Promise(resolveExit => child.once('exit', code => resolveExit(code)));
let browser, page;
try {
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    if (launchError) throw launchError;
    assert.equal(child.exitCode, null, 'The isolated Premium process stays alive');
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(500) });
      if (response.ok) { ready = true; break; }
    } catch { /* Wait only for the newly launched process. */ }
    await new Promise(resolveWait => setTimeout(resolveWait, 150));
  }
  assert.ok(ready, 'WebView2 from the isolated executable is available');
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`);
  page = browser.contexts()[0]?.pages()[0];
  assert.ok(page);
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.waitForFunction(() => typeof window.__TAURI_INTERNALS__?.invoke === 'function');
  assert.match(page.url(), /^(?:tauri:\/\/localhost|https?:\/\/tauri\.localhost)(?:\/|$)/, 'Native release serves its embedded UI');
  const info = await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('build_info'));
  assert.equal(info.edition, 'premium');
  const ipc = await page.evaluate(path => window.__TAURI_INTERNALS__.invoke('list_editable_bindings', { path }), profile);
  assert.equal(ipc.defaults_error, null);
  assert.equal(ipc.conflict_reviews_error, null);
  assert.equal(ipc.conflict_reviews.length, 90, 'Real profile review import is loaded by the native backend');
  assert.ok(Object.keys(ipc.activation_modes).length > 0);
  assert.ok(ipc.bindings.some(binding => Object.keys(binding.trigger_attributes ?? {}).length > 0));
  assert.ok(ipc.bindings.every(binding => binding.explicit_trigger_attributes && typeof binding.explicit_trigger_attributes === 'object'), 'Native DTO separates explicit attributes from resolved mode attributes');
  const directHold = ipc.bindings.find(binding => binding.actionmap === 'spaceship_power' && binding.action === 'v_engineering_assignment_engine_max' && binding.device === 'kb1');
  assert.ok(directHold, 'Real F6 engine allocation hold action is present');
  assert.equal(directHold.explicit_trigger_attributes.onHold, '1');
  assert.equal(directHold.explicit_trigger_attributes.holdTriggerDelay, '0.25');
  const engine = await import(pathToFileURL(join(premium, 'vendor/spaceMapper/packages/app-core/dist/index.js')));
  const pending = new Map();
  const rules = new engine.ContextRules(ipc.colliding_contexts);
  const index = engine.indexConflicts(ipc.bindings, pending, rules, ipc.conflict_reviews);
  const expected = JSON.parse(await readFile(join(root, 'docs/diagnostic-profile-after-2026-09-10.json'), 'utf8')).summary;
  assert.equal(ipc.bindings.length, expected.merged_rows);
  assert.equal(index.flagged.size, expected.flagged_assignment_keys);
  assert.equal(index.uncertain.size, expected.uncertain_assignment_keys);
  const validations = ipc.conflict_reviews.map(review => {
    const rows = review.actions.map(action => ipc.bindings.find(binding => binding.actionmap === action.actionmap && binding.action === action.action && engine.canonicalControlToken(binding.input_raw) === engine.canonicalControlToken(review.control)));
    assert.ok(rows.every(Boolean));
    const assessment = engine.assessConflictPair(rows[0], rows[1], pending, rules, ipc.conflict_reviews);
    assert.equal(assessment.reason, `review_${review.verdict}`, review.source_case_id);
    return { case: review.source_case_id, verdict: review.verdict, assessment };
  });
  const conflictButton = page.getByRole('button', { name: new RegExp(`^Conflits\\s*${index.flagged.size}$`) });
  await conflictButton.waitFor();
  assert.equal(await page.getByText(/À vérifier|To check/).count(), 0, 'Manual verification stays in the external notebook');
  await conflictButton.click();
  await page.getByText(`${index.flagged.size} / ${ipc.bindings.length}`, { exact: true }).waitFor();
  await page.screenshot({ path: join(artifactRoot, 'premium-native-diagnostic-probable.png'), fullPage: true });
  assert.deepEqual(errors, []);
  assert.equal(await hash(profile), before.profile, 'Game profile is unchanged');
  assert.equal(await hash(reviews), before.reviews, 'Real user reviews are unchanged');
  const report = { executable, copiedExecutable, executableSha256: before.executable, sandbox, url: page.url(), info, merged_rows: ipc.bindings.length, probable_assignments: index.flagged.size, verification_ui_absent: true, review_validations: validations, errors, source_hashes_unchanged: before };
  await writeFile(join(artifactRoot, 'premium-native-diagnostic-result.json'), JSON.stringify(report, null, 2));
  await writeFile(join(sandbox, 'native-merged-bindings.json'), JSON.stringify(ipc));
  // Only this CDP-attached isolated process receives the graceful quit command.
  await page.evaluate(() => window.__TAURI_INTERNALS__.invoke('desktop_quit')).catch(() => {});
  const exitCode = await Promise.race([exited, new Promise(resolveWait => setTimeout(() => resolveWait('timeout'), 5000))]);
  assert.equal(exitCode, 0, 'Isolated Premium process exits cleanly');
  console.log(JSON.stringify({ success: true, probable_assignments: index.flagged.size, verification_ui_absent: true, imported_reviews_verified: validations.length, sandbox }, null, 2));
} catch (error) {
  if (page && !page.isClosed()) await page.screenshot({ path: join(artifactRoot, 'premium-native-diagnostic-failure.png') }).catch(() => {});
  throw error;
} finally {
  if (child.exitCode === null && child.pid) child.kill();
  await browser?.close().catch(() => {});
}
