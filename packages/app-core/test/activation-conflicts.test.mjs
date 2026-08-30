import assert from "node:assert/strict";
import test from "node:test";

import {
  ContextRules,
  activationGestureOf,
  activationGesturesOverlap,
  hasConflict,
  indexConflicts,
  keyOf,
  rivalsOf,
} from "../dist/index.js";

const gesture = (activation_mode = null, multi_tap = null) => ({
  activation_mode,
  multi_tap,
});

test("normalise les gestes observés dans les profils Star Citizen", () => {
  assert.equal(activationGestureOf(gesture()), "short_press");
  assert.equal(activationGestureOf(gesture("press")), "short_press");
  assert.equal(activationGestureOf(gesture("tap")), "short_press");
  assert.equal(activationGestureOf(gesture("hold")), "long_press");
  assert.equal(activationGestureOf(gesture("delayed_hold_long")), "long_press");
  assert.equal(activationGestureOf(gesture("double_tap")), "multi_tap:2");
  assert.equal(activationGestureOf(gesture("press", "2")), "multi_tap:2");
  assert.equal(activationGestureOf(gesture("press", "3")), "multi_tap:3");
});

test("sépare appui court, appui long et double-appui", () => {
  const short = gesture("press");
  const long = gesture("hold_toggle");
  const double = gesture("double_tap_nonblocking");

  assert.equal(activationGesturesOverlap(short, long), false);
  assert.equal(activationGesturesOverlap(short, double), false);
  assert.equal(activationGesturesOverlap(long, double), false);
  assert.equal(activationGesturesOverlap(gesture("hold"), long), true);
  assert.equal(activationGesturesOverlap(gesture("double_tap"), double), true);
});

test("reste conservateur pour un mode futur ou un multiTap corrompu", () => {
  assert.equal(activationGestureOf(gesture("future_mode")), "unknown");
  assert.equal(activationGestureOf(gesture("press", "2x")), "unknown");
  assert.equal(
    activationGesturesOverlap(gesture("future_mode"), gesture("press")),
    true,
  );
});

function binding(action, activation_mode, multi_tap = null) {
  return {
    actionmap: "spaceship_movement",
    origin: "override",
    action,
    label: null,
    description: null,
    context: "ship_seat",
    input_raw: "js1_button5",
    device: "js1",
    modifier: null,
    control: "button5",
    activation_mode,
    multi_tap,
  };
}

test("l'index de conflits ignore un même bouton utilisé avec des gestes distincts", () => {
  const short = binding("v_short", "press");
  const long = binding("v_long", "hold");
  const double = binding("v_double", "double_tap");
  const bindings = [short, long, double];
  const pending = new Map();
  const conflicts = indexConflicts(bindings, pending, new ContextRules(null));

  for (const item of bindings) {
    assert.equal(hasConflict(item, pending, conflicts), false);
    assert.deepEqual(rivalsOf(item, pending, conflicts), []);
  }
});

test("l'index conserve les vrais conflits au sein d'un même geste", () => {
  const first = binding("v_first", "tap");
  const second = binding("v_second", "press");
  const pending = new Map();
  const conflicts = indexConflicts(
    [first, second],
    pending,
    new ContextRules(null),
  );

  assert.equal(hasConflict(first, pending, conflicts), true);
  assert.equal(hasConflict(second, pending, conflicts), true);
  assert.deepEqual(rivalsOf(first, pending, conflicts), [second]);
});

test("une capture en attente compare le nouveau bouton avec le geste existant", () => {
  const short = { ...binding("v_short", "press"), input_raw: "js1_button1", control: "button1" };
  const long = { ...binding("v_long", "hold"), input_raw: "js1_button2", control: "button2" };
  const pending = new Map([[keyOf(long), "js1_button1"]]);
  const conflicts = indexConflicts(
    [short, long],
    pending,
    new ContextRules(null),
  );

  assert.equal(hasConflict(short, pending, conflicts), false);
  assert.equal(hasConflict(long, pending, conflicts), false);
});

test("plusieurs lignes d'une même action ne sont pas rivales", () => {
  const first = binding("v_same_action", "press");
  const second = {
    ...binding("v_same_action", "tap"),
    input_raw: "js1_button6",
    control: "button6",
  };
  // Deux lignes distinctes convergent vers le même bouton après une édition.
  // Elles décrivent toujours une seule action et ne doivent produire ni badge
  // de conflit dans l'index, ni rival dans le volet de détail.
  const pending = new Map([[keyOf(second), "js1_button5"]]);
  const conflicts = indexConflicts(
    [first, second],
    pending,
    new ContextRules(null),
  );

  assert.equal(hasConflict(first, pending, conflicts), false);
  assert.equal(hasConflict(second, pending, conflicts), false);
  assert.deepEqual(rivalsOf(first, pending, conflicts), []);
  assert.deepEqual(rivalsOf(second, pending, conflicts), []);
});
