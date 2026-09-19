import assert from "node:assert/strict";
import test from "node:test";

import { ContextRules, filters, indexConflicts, keyOf } from "../dist/index.js";

const directionalActions = [
  "v_pitch_up", "v_pitch_down",
  "v_yaw_left", "v_yaw_right",
  "v_roll_left", "v_roll_right",
  "v_strafe_up", "v_strafe_down", "v_strafe_left", "v_strafe_right",
  "v_strafe_forward", "v_strafe_back",
];

function binding(action, input_raw = "", extra = {}) {
  const separator = input_raw.indexOf("_");
  return {
    actionmap: "spaceship_movement",
    action,
    origin: "game_default",
    label: null,
    description: null,
    context: "ship_seat",
    input_raw,
    device: separator < 0 ? null : input_raw.slice(0, separator),
    control: separator < 0 ? null : input_raw.slice(separator + 1),
    modifier: null,
    activation_mode: "press",
    multi_tap: null,
    ...extra,
  };
}

function visible(items, mode = "joystick", options = {}, pending = new Map()) {
  const conflicts = indexConflicts(items, pending, new ContextRules(null));
  return filters.apply(items, { ...filters.NO_FILTERS, ...options }, mode, pending, conflicts);
}

test("le mode joystick masque les directions de vol par touche, assignées ou disponibles", () => {
  const items = directionalActions.flatMap(action =>
    ["", "js1_", "js1_ ", "js1_button1"].map(token => binding(action, token)),
  );

  assert.deepEqual(visible(items), []);
});

test("le mode joystick conserve les axes et les autres commandes utilisables", () => {
  const axes = [
    "v_pitch", "v_yaw", "v_roll",
    "v_strafe_vertical", "v_strafe_lateral", "v_strafe_longitudinal",
    "v_strafe_longitudinal_invert",
  ];
  const items = [
    ...axes.flatMap(action => [binding(action, "js1_ "), binding(action, "js1_x")]),
    binding("v_afterburner", "js1_button1"),
    binding("v_toggle_landing_system"),
    binding("v_pitch_up", "js1_button2", { actionmap: "spaceship_view" }),
    binding("v_view_pitch_up", "js1_hat1_up", { actionmap: "spaceship_view" }),
    binding("eva_strafe_left", "js1_button3", { actionmap: "zero_gravity_eva", context: "eva" }),
    binding("v_strafe_future_direction"),
  ];

  assert.deepEqual(visible(items), items);
});

test("les directions par touche restent proposées en mode clavier, manette et tous", () => {
  const unassigned = directionalActions.map(action => binding(action));
  const keyboard = directionalActions.map(action => binding(action, "kb1_w"));
  const gamepad = directionalActions.map(action => binding(action, "gp1_dpad_up"));
  const joystick = directionalActions.map(action => binding(action, "js1_button1"));
  const items = [...unassigned, ...keyboard, ...gamepad, ...joystick];

  assert.deepEqual(visible(items, "all"), items);
  assert.deepEqual(visible(items, "desk"), [...unassigned, ...keyboard]);
  assert.deepEqual(visible(items, "gamepad"), [...unassigned, ...gamepad]);
});

test("la recherche et le filtre non assigné ne font pas réapparaître les directions par touche", () => {
  const hidden = [binding("v_pitch_up", "js1_ "), binding("v_pitch_down", "js1_button1")];
  const availableAxis = binding("v_pitch", "js1_ ");
  const assignedAxis = binding("v_pitch", "js1_y");
  const items = [...hidden, availableAxis, assignedAxis];

  assert.deepEqual(visible(items, "joystick", { query: "v_pitch" }), [availableAxis, assignedAxis]);
  assert.deepEqual(visible(items, "joystick", { query: "v_pitch_up" }), []);
  assert.deepEqual(visible(items, "joystick", { unassignedOnly: true }), [availableAxis]);
  assert.deepEqual(visible(items, "joystick", { query: "v_pitch", unassignedOnly: true }), [availableAxis]);

  const pending = new Map([
    [keyOf(hidden[0]), "js1_button2"],
    [keyOf(hidden[1]), null],
    [keyOf(assignedAxis), null],
  ]);
  assert.deepEqual(visible(items, "joystick", { unassignedOnly: true }, pending), [availableAxis, assignedAxis]);
});
