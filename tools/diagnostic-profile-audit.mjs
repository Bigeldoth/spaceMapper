/** Execute the snapshotted app conflict functions, without reimplementing them. */
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const [snapshot, reviewsPath, outputPath, importedReviewsPath] = process.argv.slice(2);
if (!outputPath) throw new Error('Usage: diagnostic-profile-audit.mjs <snapshot> <reviews.json> <output.json>');
const require = createRequire(resolve('package.json'));
const ts = require('typescript');
for (const name of ['activation', 'conflicts']) {
  const source = await readFile(join(snapshot, `${name}.ts`), 'utf8');
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText;
  await writeFile(join(snapshot, `${name}.mjs`), compiled.replaceAll('from "./activation"', 'from "./activation.mjs"'));
}
const engine = await import(pathToFileURL(join(snapshot, 'conflicts.mjs')));
const { ContextRules, indexConflicts, rivalsOf, keyOf, effectiveToken } = engine;
const activation = await import(pathToFileURL(join(snapshot, 'activation.mjs')));
const { activationGestureOf } = activation;
const merged = JSON.parse(await readFile(join(snapshot, 'merged-bindings.json'), 'utf8'));
const reviews = JSON.parse(await readFile(reviewsPath, 'utf8'));
const provenance = JSON.parse(await readFile(join(snapshot, 'provenance.json'), 'utf8'));
const pending = new Map();
const bindings = merged.bindings;
const rules = new ContextRules(merged.colliding_contexts);
let importedReviews = [];
if (engine.assessConflictPair && importedReviewsPath) {
  const imported = JSON.parse(await readFile(importedReviewsPath, 'utf8'));
  const normalizePath = value => value.replaceAll('\\', '/').toLowerCase();
  importedReviews = imported.profiles.find(profile => normalizePath(profile.profile_path) === normalizePath(provenance.sources.profile.path))?.reviews ?? [];
}
const index = indexConflicts(bindings, pending, rules, importedReviews);
const assigned = bindings.filter(binding => effectiveToken(binding, pending) !== null);
const flagged = assigned.filter(binding => index.flagged.has(keyOf(binding)));
const countBy = (items, selector) => Object.fromEntries([...items.reduce((map, item) => {
  const key = selector(item); map.set(key, (map.get(key) || 0) + 1); return map;
}, new Map())].sort((left, right) => right[1] - left[1]));
const pairKey = (a, b) => [keyOf(a), keyOf(b)].sort().join(' || ');
const pairMap = new Map();
for (const binding of flagged) for (const rival of rivalsOf(binding, pending, index)) {
  const key = pairKey(binding, rival);
  if (!pairMap.has(key)) pairMap.set(key, { key, input_raw: binding.input_raw, origins: [binding.origin, rival.origin].sort().join(' + '), actions: [binding, rival] });
}
const pairs = [...pairMap.values()];
const uncertainRows = assigned.filter(binding => index.uncertain?.has(keyOf(binding)));
const uncertainPairMap = new Map();
if (engine.uncertainRivalsOf) for (const binding of uncertainRows) for (const rival of engine.uncertainRivalsOf(binding, pending, index)) {
  const key = pairKey(binding, rival);
  if (!uncertainPairMap.has(key)) uncertainPairMap.set(key, { key, input_raw: binding.input_raw, origins: [binding.origin, rival.origin].sort().join(' + '), actions: [binding, rival], assessment: engine.assessConflictPair(binding, rival, pending, rules, importedReviews) });
}
const uncertainPairs = [...uncertainPairMap.values()];
const importedReviewValidation = importedReviews.map(review => {
  const rows = review.actions.map(action => assigned.find(binding => binding.actionmap === action.actionmap && binding.action === action.action && engine.canonicalControlToken(binding.input_raw) === engine.canonicalControlToken(review.control)));
  const assessment = rows.every(Boolean) ? engine.assessConflictPair(rows[0], rows[1], pending, rules, importedReviews) : null;
  return { source_case_id: review.source_case_id, verdict: review.verdict, matched: assessment?.reason === `review_${review.verdict}`, assessment, actions: review.actions.map((action, i) => ({ id: `${action.actionmap}/${action.action}`, expected: action.trigger_signature, actual: rows[i] ? activation.triggerSignatureOf(rows[i]) : 'missing_binding' })) };
});
const reviewedPairs = Object.values(reviews.feedback).map(feedback => {
  const snapshot = feedback.case_snapshot;
  const actions = snapshot?.actions?.map(action => ({ actionmap: action.id.split('/')[0], action: action.id.split('/')[1], input_raw: snapshot.control_raw }));
  return { case_id: feedback.case_id, verdict: feedback.verdict, comment: feedback.comment, key: actions?.length === 2 ? pairKey(...actions) : null };
});
const reviewLookup = new Map(reviewedPairs.filter(review => review.key).map(review => [review.key, review]));
for (const pair of pairs) pair.user_review = reviewLookup.get(pair.key) ?? null;
const summary = {
  profile_rebind_count: merged.profile_rebind_count,
  default_action_count: merged.default_action_count,
  merged_rows: bindings.length,
  assigned_rows: assigned.length,
  unassigned_rows: bindings.length - assigned.length,
  flagged_assignment_keys: index.flagged.size,
  flagged_rows: flagged.length,
  flagged_distinct_actions: new Set(flagged.map(binding => `${binding.actionmap}/${binding.action}`)).size,
  conflicting_pairs: pairs.length,
  uncertain_assignment_keys: index.uncertain?.size ?? 0,
  uncertain_pairs: uncertainPairs.length,
  uncertain_pair_reasons: countBy(uncertainPairs, pair => pair.assessment.reason),
  probable_and_uncertain_assignment_keys: flagged.filter(binding => index.uncertain?.has(keyOf(binding))).length,
  total_by_origin: countBy(bindings, binding => binding.origin),
  assigned_by_origin: countBy(assigned, binding => binding.origin),
  flagged_by_origin: countBy(flagged, binding => binding.origin),
  pair_origins: countBy(pairs, pair => pair.origins),
  flagged_by_device: countBy(flagged, binding => binding.device),
  flagged_by_context: countBy(flagged, binding => binding.context),
  flagged_by_actionmap: countBy(flagged, binding => binding.actionmap),
  flagged_by_gesture: countBy(flagged, activationGestureOf),
  flagged_unknown_activation_modes: countBy(flagged.filter(binding => activationGestureOf(binding) === 'unknown'), binding => binding.activation_mode ?? '(missing)'),
  flagged_missing_activation_mode: flagged.filter(binding => binding.activation_mode === null).length,
  pairs_with_unknown_gesture: pairs.filter(pair => pair.actions.some(binding => activationGestureOf(binding) === 'unknown')).length,
  user_review_counts: countBy(reviewedPairs, review => review.verdict),
  matching_flagged_user_reviews: countBy(pairs.filter(pair => pair.user_review), pair => pair.user_review.verdict),
  imported_review_validation: { count: importedReviewValidation.length, matched: importedReviewValidation.filter(review => review.matched).length, mismatched: importedReviewValidation.filter(review => !review.matched).length, by_verdict: countBy(importedReviewValidation.filter(review => review.matched), review => review.verdict) },
  physical_shared_tokens: [...index.byToken.values()].filter(group => new Set(group.map(binding => `${binding.actionmap}/${binding.action}`)).size > 1).length,
};
await writeFile(outputPath, JSON.stringify({ generated_at: new Date().toISOString(), provenance, summary, colliding_contexts: merged.colliding_contexts, flagged_bindings: flagged, conflicting_pairs: pairs, uncertain_pairs: uncertainPairs, reviewed_pairs: reviewedPairs, imported_review_validation: importedReviewValidation }, null, 2) + '\n');
console.log(JSON.stringify({ summary, report: resolve(outputPath), snapshot }, null, 2));
