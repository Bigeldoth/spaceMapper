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
  assert.equal(activationGestureOf(gesture()), "immediate");
  assert.equal(activationGestureOf(gesture("press")), "immediate");
  assert.equal(activationGestureOf(gesture("tap")), "short_press");
  assert.equal(activationGestureOf(gesture("hold")), "immediate");
  assert.equal(activationGestureOf(gesture("delayed_hold_long")), "long_press");
  assert.equal(activationGestureOf(gesture("double_tap")), "multi_tap:2");
  assert.equal(activationGestureOf(gesture("press", "2")), "multi_tap:2");
  assert.equal(activationGestureOf(gesture("press", "3")), "multi_tap:3");
});

test("sépare appui court, appui long et double-appui", () => {
  const short = gesture("tap");
  const long = gesture("delayed_press");
  const double = gesture("double_tap");

  assert.equal(activationGesturesOverlap(short, long), false);
  assert.equal(activationGesturesOverlap(short, double), false);
  assert.equal(activationGesturesOverlap(long, double), false);
  assert.equal(activationGesturesOverlap(gesture("hold"), long), false);
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

test("les conflits comparent les usages configurés, y compris un double appui non bloquant", () => {
  assert.equal(activationGesturesOverlap(gesture("hold"), gesture("tap")), true);
  assert.equal(activationGesturesOverlap(gesture("hold"), gesture("delayed_press")), false);
  assert.equal(activationGesturesOverlap(gesture("double_tap_nonblocking"), gesture("tap")), false);
  assert.equal(activationGesturesOverlap(gesture("press", "2"), gesture("tap")), false);
  assert.equal(activationGesturesOverlap(gesture("double_tap", "2"), gesture("tap")), false);
  assert.equal(activationGesturesOverlap(gesture("double_tap_nonblocking"), gesture("double_tap")), true);
  assert.equal(activationGesturesOverlap(gesture("press", "2"), gesture("double_tap")), true);
});

function binding(action, activation_mode, multi_tap = null) {
  const trigger_attributes = {
    press: { onPress: "1" },
    tap: { onRelease: "1", releaseTriggerThreshold: "0.25" },
    hold: { onPress: "1", onRelease: "1" },
    double_tap: { onPress: "1", multiTap: "2" },
    double_tap_nonblocking: { onPress: "1", multiTap: "2" },
    delayed_press: { onPress: "1", pressTriggerThreshold: "0.25" },
    delayed_press_medium: { onPress: "1", pressTriggerThreshold: "0.5" },
    delayed_hold_long: { onPress: "1", onRelease: "1", pressTriggerThreshold: "1.5" },
  }[activation_mode];
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
    trigger_attributes,
  };
}

test("l'index de conflits ignore un même bouton utilisé avec des gestes distincts", () => {
  const short = binding("v_short", "tap");
  const long = binding("v_long", "delayed_press");
  const double = binding("v_double", "double_tap");
  const bindings = [short, long, double];
  const pending = new Map();
  const conflicts = indexConflicts(bindings, pending, new ContextRules(null));

  for (const item of bindings) {
    assert.equal(hasConflict(item, pending, conflicts), false);
    assert.deepEqual(rivalsOf(item, pending, conflicts), []);
  }
});

test("autodestruction maintenue et éjection en double-appui ne sont pas rivales", () => {
  const shared = {
    actionmap: "spaceship_general",
    input_raw: "js2_rctrl+button5",
    device: "js2",
    modifier: "rctrl",
  };
  const selfDestruct = { ...binding("v_self_destruct", "delayed_press_medium"), ...shared };
  const eject = { ...binding("v_eject", "double_tap", "2"), ...shared };
  const pending = new Map();
  const conflicts = indexConflicts([selfDestruct, eject], pending, new ContextRules(null));

  assert.equal(activationGestureOf(selfDestruct), "long_press");
  assert.equal(activationGestureOf(eject), "multi_tap:2");
  assert.equal(hasConflict(selfDestruct, pending, conflicts), false);
  assert.equal(hasConflict(eject, pending, conflicts), false);
  assert.deepEqual(rivalsOf(selfDestruct, pending, conflicts), []);
  assert.deepEqual(rivalsOf(eject, pending, conflicts), []);
});

test("l'index conserve les conflits probables au sein d'un même déclencheur", () => {
  const first = binding("v_first", "tap");
  const second = binding("v_second", "tap");
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
  const short = { ...binding("v_short", "tap"), input_raw: "js1_button1", control: "button1" };
  const long = { ...binding("v_long", "delayed_press"), input_raw: "js1_button2", control: "button2" };
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

test("un appui simple implicite ou explicite reste distinct du double appui et de l'appui long", () => {
  for (const simple of [gesture(), gesture("press"), gesture("tap")]) {
    for (const distinct of [
      gesture("double_tap"),
      gesture("double_tap_nonblocking"),
      gesture("press", "2"),
      gesture("delayed_press"),
      gesture("delayed_hold_long"),
    ]) {
      assert.equal(activationGesturesOverlap(simple, distinct), false);
      assert.equal(activationGesturesOverlap(distinct, simple), false);
    }
  }
  assert.equal(activationGesturesOverlap(gesture(), gesture("tap")), true);
  assert.equal(activationGesturesOverlap(gesture("press"), gesture("tap")), true);
  assert.equal(activationGesturesOverlap(gesture("press", "2"), gesture("press", "3")), false);
});

test("un usage inconnu reste rival de chaque geste connu dans les deux sens", () => {
  for (const unknown of [gesture("future_mode"), gesture("press", "2x")]) {
    for (const known of [gesture("press"), gesture("double_tap"), gesture("delayed_press")]) {
      assert.equal(activationGesturesOverlap(unknown, known), true);
      assert.equal(activationGesturesOverlap(known, unknown), true);
    }
  }
});

test("entrer dans la tourelle et verrouiller tous les ports partagent Ctrl + bouton 5 sans conflit", () => {
  const common = { input_raw: "js1_rctrl+button5", modifier: "rctrl" };
  const turret = {
    ...binding("v_enter_remote_turret_1", "press"),
    ...common,
    actionmap: "seat_general",
  };
  const portLocks = {
    ...binding("v_toggle_all_portlocks", "double_tap", "2"),
    ...common,
    actionmap: "spaceship_general",
  };
  const pending = new Map();
  const conflicts = indexConflicts([turret, portLocks], pending, new ContextRules([["ship_seat", "ship_seat"]]));

  assert.equal(hasConflict(turret, pending, conflicts), false);
  assert.equal(hasConflict(portLocks, pending, conflicts), false);
  assert.deepEqual(rivalsOf(turret, pending, conflicts), []);
  assert.deepEqual(rivalsOf(portLocks, pending, conflicts), []);
});

const usageModifiers = [null, "rctrl", "rshift", "rctrl+rshift", "ralt"];

// Même contrat que merged_bindings_serializes_the_context_conflict_policy en Rust.
const serializedContextPairs = [
  ["on_foot", "on_foot"],
  ["on_foot", "interface_hud"],
  ["ship_seat", "ship_seat"],
  ["ship_seat", "ship_scanning"],
  ["ship_seat", "ship_mining"],
  ["ship_seat", "ship_salvage"],
  ["ship_seat", "interface_hud"],
  ["ship_seat", "always"],
  ["ship_scanning", "ship_scanning"],
  ["ship_scanning", "interface_hud"],
  ["ship_scanning", "always"],
  ["ship_mining", "ship_mining"],
  ["ship_mining", "interface_hud"],
  ["ship_mining", "always"],
  ["ship_salvage", "ship_salvage"],
  ["ship_salvage", "interface_hud"],
  ["ship_salvage", "always"],
  ["turret", "turret"],
  ["turret", "interface_hud"],
  ["turret", "always"],
  ["interface_hud", "interface_hud"],
  ["interface_hud", "always"],
  ["always", "always"],
];

const actionmapsByContext = {
  on_foot: "player",
  ship_seat: "spaceship_movement",
  ship_scanning: "spaceship_scanning",
  ship_mining: "spaceship_mining",
  ship_salvage: "spaceship_salvage",
  turret: "turret_movement",
  eva: "zero_gravity_eva",
  ground_vehicle: "vehicle_driver",
  map: "mapui",
  interface_hud: "default",
  always: "unknown_actionmap",
  out_of_game: "spectator",
};

function contextBinding(action, context) {
  return {
    ...usageBinding(action, "rctrl", "press"),
    actionmap: actionmapsByContext[context],
    context,
  };
}

test("le diagnostic applique les exclusions de contexte aux usages identiques", () => {
  const rules = new ContextRules(serializedContextPairs);
  const scenarios = [
    ["on_foot", "always", false],
    ["on_foot", "ship_seat", false],
    ["on_foot", "eva", false],
    ["on_foot", "turret", false],
    ["ground_vehicle", "ground_vehicle", false],
    ["ground_vehicle", "always", false],
    ["ground_vehicle", "ship_seat", false],
    ["ground_vehicle", "on_foot", false],
    ["ground_vehicle", "turret", false],
    ["turret", "ship_seat", false],
    ["turret", "ship_scanning", false],
    ["turret", "ship_mining", false],
    ["turret", "ship_salvage", false],
    ["on_foot", "on_foot", true],
    ["on_foot", "interface_hud", true],
    ["interface_hud", "ship_seat", true],
    ["interface_hud", "turret", true],
    ["interface_hud", "interface_hud", true],
    ["interface_hud", "always", true],
    ["ship_seat", "ship_seat", true],
    ["ship_seat", "ship_mining", true],
    ["turret", "turret", true],
    ["always", "ship_seat", true],
    ["always", "turret", true],
    ["always", "out_of_game", false],
  ];
  for (const [leftContext, rightContext, expected] of scenarios) {
    const left = contextBinding("action_left", leftContext);
    const right = contextBinding("action_right", rightContext);
    const pending = new Map();
    for (const bindings of [[left, right], [right, left]]) {
      const conflicts = indexConflicts(bindings, pending, rules);
      const description = leftContext + " / " + rightContext;

      assert.equal(hasConflict(left, pending, conflicts), expected, description);
      assert.equal(hasConflict(right, pending, conflicts), expected, description);
      assert.deepEqual(rivalsOf(left, pending, conflicts), expected ? [right] : [], description);
      assert.deepEqual(rivalsOf(right, pending, conflicts), expected ? [left] : [], description);
    }
  }
});

test("carte, spectateur, EVA et véhicules restent exclus face à chaque contexte", () => {
  const rules = new ContextRules(serializedContextPairs);
  for (const excludedContext of ["map", "out_of_game", "eva", "ground_vehicle"]) {
    for (const otherContext of Object.keys(actionmapsByContext)) {
      const excluded = contextBinding("action_excluded", excludedContext);
      const other = contextBinding("action_other", otherContext);
      const pending = new Map();
      const conflicts = indexConflicts([excluded, other], pending, rules);
      const description = excludedContext + " / " + otherContext;

      assert.equal(rules.canCollide(excludedContext, otherContext), false, description);
      assert.equal(rules.canCollide(otherContext, excludedContext), false, description);
      assert.equal(hasConflict(excluded, pending, conflicts), false, description);
      assert.equal(hasConflict(other, pending, conflicts), false, description);
      assert.deepEqual(rivalsOf(excluded, pending, conflicts), [], description);
      assert.deepEqual(rivalsOf(other, pending, conflicts), [], description);
    }
  }
});

test("mobiGlas et à pied ne sont rivaux que pour la même combinaison et le même appui", () => {
  const foot = contextBinding("moveforward", "on_foot");
  const rules = new ContextRules(serializedContextPairs);
  for (const modifier of [null, "rctrl"]) {
    for (const mode of ["press", "double_tap", "delayed_press"]) {
      const hud = {
        ...usageBinding("mobiglas", modifier, mode),
        actionmap: "default",
        context: "interface_hud",
      };
      const pending = new Map();
      const conflicts = indexConflicts([foot, hud], pending, rules);
      const expected = modifier === "rctrl" && mode === "press";

      assert.equal(hasConflict(foot, pending, conflicts), expected);
      assert.equal(hasConflict(hud, pending, conflicts), expected);
      assert.deepEqual(rivalsOf(foot, pending, conflicts), expected ? [hud] : []);
      assert.deepEqual(rivalsOf(hud, pending, conflicts), expected ? [foot] : []);
    }
  }
});

test("une capture en attente détecte mobiGlas face à pied sans faire remonter la carte ni EVA", () => {
  const foot = contextBinding("moveforward", "on_foot");
  const hud = {
    ...contextBinding("mobiglas", "interface_hud"),
    input_raw: "js1_button6",
    control: "button6",
    modifier: null,
  };
  const map = contextBinding("map_zoom", "map");
  const eva = contextBinding("eva_forward", "eva");
  const pending = new Map([[keyOf(hud), foot.input_raw]]);
  const conflicts = indexConflicts([foot, hud, map, eva], pending, new ContextRules(serializedContextPairs));

  assert.deepEqual(rivalsOf(foot, pending, conflicts), [hud]);
  assert.deepEqual(rivalsOf(hud, pending, conflicts), [foot]);
  assert.equal(hasConflict(map, pending, conflicts), false);
  assert.equal(hasConflict(eva, pending, conflicts), false);
});


test("une matrice chargée mais vide ne crée aucun conflit", () => {
  const left = contextBinding("action_left", "ship_seat");
  const right = contextBinding("action_right", "ship_seat");
  const rules = new ContextRules([]);
  const pending = new Map();
  const conflicts = indexConflicts([left, right], pending, rules);

  assert.equal(rules.canCollide("ship_seat", "ship_seat"), false);
  assert.equal(hasConflict(left, pending, conflicts), false);
  assert.equal(hasConflict(right, pending, conflicts), false);
  assert.deepEqual(rivalsOf(left, pending, conflicts), []);
  assert.deepEqual(rivalsOf(right, pending, conflicts), []);
});

test("une matrice indisponible conserve le diagnostic prudent", () => {
  const left = contextBinding("action_left", "on_foot");
  const right = contextBinding("action_right", "always");
  const rules = new ContextRules(null);
  const pending = new Map();
  const conflicts = indexConflicts([left, right], pending, rules);

  assert.equal(rules.canCollide("on_foot", "always"), true);
  assert.equal(hasConflict(left, pending, conflicts), true);
  assert.equal(hasConflict(right, pending, conflicts), true);
  assert.deepEqual(rivalsOf(left, pending, conflicts), [right]);
  assert.deepEqual(rivalsOf(right, pending, conflicts), [left]);
});
const usageGestures = ["press", "double_tap", "delayed_press"];

function usageBinding(action, modifier, activationMode) {
  return {
    ...binding(action, activationMode),
    input_raw: `js1_${modifier ? `${modifier}+` : ""}button5`,
    modifier,
  };
}

test("la matrice modificateurs × gestes ne signale que les usages identiques", () => {
  const pending = new Map();
  const rules = new ContextRules([["ship_seat", "ship_seat"]]);
  for (const leftModifier of usageModifiers) {
    for (const rightModifier of usageModifiers) {
      for (const leftGesture of usageGestures) {
        for (const rightGesture of usageGestures) {
          const left = usageBinding("v_left", leftModifier, leftGesture);
          const right = usageBinding("v_right", rightModifier, rightGesture);
          const conflicts = indexConflicts([left, right], pending, rules);
          const expected = leftModifier === rightModifier && leftGesture === rightGesture;
          const description = `${left.input_raw} / ${leftGesture} vs ${right.input_raw} / ${rightGesture}`;

          assert.equal(hasConflict(left, pending, conflicts), expected, description);
          assert.equal(hasConflict(right, pending, conflicts), expected, description);
          assert.deepEqual(rivalsOf(left, pending, conflicts), expected ? [right] : [], description);
          assert.deepEqual(rivalsOf(right, pending, conflicts), expected ? [left] : [], description);
        }
      }
    }
  }
});

test("un usage identique dans deux contextes exclusifs ne crée pas de conflit", () => {
  const ship = usageBinding("v_ship", "rctrl+rshift", "press");
  const onFoot = { ...usageBinding("v_on_foot", "rctrl+rshift", "press"), context: "on_foot" };
  const pending = new Map();
  const rules = new ContextRules([["ship_seat", "ship_seat"], ["on_foot", "on_foot"]]);
  const conflicts = indexConflicts([ship, onFoot], pending, rules);

  assert.equal(hasConflict(ship, pending, conflicts), false);
  assert.equal(hasConflict(onFoot, pending, conflicts), false);
  assert.deepEqual(rivalsOf(ship, pending, conflicts), []);
  assert.deepEqual(rivalsOf(onFoot, pending, conflicts), []);
});

test("une capture en attente conserve tous les modificateurs et le geste dans le diagnostic", () => {
  const rules = new ContextRules([["ship_seat", "ship_seat"]]);
  for (const leftModifier of usageModifiers) {
    for (const pendingModifier of usageModifiers) {
      for (const leftGesture of usageGestures) {
        for (const editedGesture of usageGestures) {
          const left = usageBinding("v_existing", leftModifier, leftGesture);
          const edited = {
            ...usageBinding("v_edited", null, editedGesture),
            input_raw: "js1_button6",
            control: "button6",
          };
          const capturedToken = usageBinding("v_capture", pendingModifier, editedGesture).input_raw;
          const pending = new Map([[keyOf(edited), capturedToken]]);
          const conflicts = indexConflicts([left, edited], pending, rules);
          const expected = leftModifier === pendingModifier && leftGesture === editedGesture;
          const description = `${left.input_raw} / ${leftGesture} vs capture ${capturedToken} / ${editedGesture}`;

          assert.equal(hasConflict(left, pending, conflicts), expected, description);
          assert.equal(hasConflict(edited, pending, conflicts), expected, description);
          assert.deepEqual(rivalsOf(left, pending, conflicts), expected ? [edited] : [], description);
          assert.deepEqual(rivalsOf(edited, pending, conflicts), expected ? [left] : [], description);
        }
      }
    }
  }
});
