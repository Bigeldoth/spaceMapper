import { invoke as v } from "@tauri-apps/api/core";
import { useState as f, useEffect as L, createContext as K, useContext as G, useMemo as W, useRef as Q } from "react";
import { jsx as n, jsxs as c, Fragment as M } from "react/jsx-runtime";
const _ = {
  listDevices: () => v("list_devices"),
  locateActionmaps: () => v("locate_actionmaps"),
  buildInfo: () => v("build_info"),
  /** Confronte le profil au matériel branché. */
  diagnoseDevices: (e) => v("diagnose_devices", { path: e }),
  /** Profils exportés présents dans `Controls\mappings`. */
  listLayouts: (e) => v("list_layouts", { path: e }),
  /** Détaille un profil exporté, sans rien y écrire. */
  inspectLayout: (e) => v("inspect_layout", { path: e }),
  /** Surcharges du joueur fusionnées avec les valeurs par défaut du jeu. */
  listEditableBindings: (e) => v("list_editable_bindings", { path: e }),
  /**
   * Écrit un lot de modifications en une seule fois.
   * Renvoie le chemin du point de restauration créé, ou `null`.
   */
  saveBindings: (e, t, r) => v("save_bindings", {
    path: e,
    edits: t,
    createRestorePoint: r
  }),
  /** Crée un point de restauration ; renvoie le chemin du fichier créé. */
  createBackup: (e) => v("create_backup", { path: e }),
  listBackups: () => v("list_backups"),
  /**
   * Supprime définitivement un point de restauration.
   *
   * Le backend refuse toute cible qui n'est pas une sauvegarde de SpaceMapper :
   * il détermine lui-même le dossier autorisé et ne se fie pas à ce chemin.
   */
  deleteBackup: (e) => v("delete_backup", { backupPath: e }),
  /** Langues réellement présentes dans l'installation du joueur. */
  listGameLanguages: (e) => v("list_game_languages", { path: e }),
  getSettings: () => v("get_settings"),
  setSettings: (e) => v("set_settings", { settings: e }),
  /**
   * Ouvre une session de lecture sur plusieurs périphériques à la fois.
   * Renvoie le numéro de session, à repasser à `stopCapture`.
   */
  startCapture: (e) => v("start_capture", { guids: e }),
  /** Dernier contrôle actionné, ou `null` si rien n'a été pressé. */
  pollCapture: () => v("poll_capture"),
  /** Oublie le dernier relevé sans fermer la session. */
  clearCapture: () => v("clear_capture"),
  /** N'arrête que la session désignée : voir le commentaire côté Rust. */
  stopCapture: (e) => v("stop_capture", { id: e }),
  restoreBackup: (e, t) => v("restore_backup", { path: e, backupPath: t })
}, D = {
  // ── Pilotage : spaceship_movement ──────────────────────────────────────
  v_afterburner: "Postcombustion (boost)",
  v_autoland: "Atterrissage automatique",
  v_pitch_up: "Cabrer",
  v_pitch_down: "Piquer",
  v_yaw_left: "Lacet à gauche",
  v_yaw_right: "Lacet à droite",
  v_roll_left: "Roulis à gauche",
  v_roll_right: "Roulis à droite",
  v_strafe_up: "Translation vers le haut",
  v_strafe_down: "Translation vers le bas",
  v_strafe_left: "Translation à gauche",
  v_strafe_right: "Translation à droite",
  v_strafe_vertical: "Axe — translation verticale",
  v_strafe_lateral: "Axe — translation latérale",
  v_strafe_longitudinal: "Axe — translation avant/arrière",
  v_strafe_longitudinal_invert: "Axe — translation avant/arrière (inversé)",
  v_toggle_landing_system: "Train d'atterrissage",
  v_toggle_jump_request: "Demander un saut",
  v_toggle_yaw_roll_swap: "Permuter lacet et roulis",
  // ── Conduite : vehicle_driver ──────────────────────────────────────────
  v_boost: "Boost",
  v_brake: "Frein",
  v_move: "Axe — avancer/reculer",
  v_move_forward: "Avancer",
  v_move_back: "Reculer",
  v_pitch: "Axe — tangage",
  v_yaw: "Axe — lacet",
  v_mgv_switch_brake_on_idle: "Frein automatique à l'arrêt",
  v_view_dynamic_zoom_abs: "Axe — zoom absolu",
  v_view_dynamic_zoom_abs_toggle: "Basculer le zoom absolu",
  v_view_dynamic_zoom_rel: "Axe — zoom relatif",
  v_view_dynamic_zoom_rel_in: "Zoom avant",
  v_view_dynamic_zoom_rel_out: "Zoom arrière",
  // ── À pied : player ────────────────────────────────────────────────────
  moveforward: "Avancer",
  moveback: "Reculer",
  moveleft: "Aller à gauche",
  moveright: "Aller à droite",
  walk: "Marcher (au lieu de courir)",
  use: "Interagir",
  inspect: "Inspecter",
  drop: "Lâcher l'objet",
  attack1: "Attaquer",
  weapon_melee: "Corps à corps",
  nextweapon: "Arme suivante",
  prevweapon: "Arme précédente",
  nextitem: "Objet suivant",
  prevItem: "Objet précédent",
  zoom: "Viser",
  zoom_in: "Zoom avant",
  zoom_out: "Zoom arrière",
  thirdperson: "Vue à la troisième personne",
  free_thirdperson_camera: "Caméra libre",
  combathealtarget: "Soigner la cible",
  force_respawn: "Forcer la réapparition",
  fixed_speed_increment: "Augmenter la vitesse de marche",
  fixed_speed_decrement: "Réduire la vitesse de marche",
  pl_hud_open_scoreboard: "Ouvrir le tableau des scores",
  port_modification_select: "Sélectionner un emplacement d'équipement",
  gp_rotatepitch: "Manette — tangage de la vue",
  gp_rotateyaw: "Manette — lacet de la vue",
  // ── À plat ventre : prone ──────────────────────────────────────────────
  prone_rollleft: "Rouler à gauche",
  prone_rollright: "Rouler à droite",
  // ── Menu d'interaction : player_choice ─────────────────────────────────
  pc_focus: "Mode focus",
  pc_select: "Sélectionner",
  pc_interaction_mode: "Mode interaction",
  pc_personal_back: "Retour",
  pc_personal_thought: "Menu personnel",
  pc_screen_focus_up: "Focus vers le haut",
  pc_screen_focus_down: "Focus vers le bas",
  pc_screen_focus_left: "Focus vers la gauche",
  pc_screen_focus_right: "Focus vers la droite",
  pc_zoom_in: "Zoom avant",
  pc_zoom_out: "Zoom arrière",
  // ── EVA : zero_gravity_eva ─────────────────────────────────────────────
  eva_boost: "Boost EVA",
  eva_brake: "Freiner en EVA",
  eva_roll: "Axe — roulis EVA",
  eva_roll_left: "Roulis à gauche",
  eva_roll_right: "Roulis à droite",
  eva_strafe_forward: "Avancer",
  eva_strafe_back: "Reculer",
  eva_strafe_left: "Translation à gauche",
  eva_strafe_right: "Translation à droite",
  eva_strafe_up: "Translation vers le haut",
  eva_strafe_down: "Translation vers le bas",
  eva_strafe_lateral: "Axe — translation latérale",
  eva_strafe_longitudinal: "Axe — translation avant/arrière",
  eva_strafe_vertical: "Axe — translation verticale",
  eva_toggle_headlook_mode: "Mode vue libre",
  eva_view_pitch: "Axe — tangage de la vue",
  eva_view_pitch_up: "Vue vers le haut",
  eva_view_pitch_down: "Vue vers le bas",
  eva_view_yaw: "Axe — lacet de la vue",
  eva_view_yaw_left: "Vue vers la gauche",
  eva_view_yaw_right: "Vue vers la droite",
  // ── Énergie : spaceship_power ──────────────────────────────────────────
  v_power_toggle: "Allumer / éteindre le vaisseau",
  v_power_toggle_shields: "Alimenter les boucliers",
  v_power_toggle_weapons: "Alimenter les armes",
  v_power_throttle_up: "Augmenter l'énergie",
  v_power_throttle_down: "Réduire l'énergie",
  v_power_throttle_max: "Énergie au maximum",
  v_power_throttle_min: "Énergie au minimum",
  // ── Vue : spaceship_view ───────────────────────────────────────────────
  v_view_mode: "Changer de vue",
  v_view_option: "Option de vue",
  v_view_interact: "Vue d'interaction",
  v_view_cycle_fwd: "Vue suivante",
  v_view_cycle_internal_fwd: "Vue interne suivante",
  v_view_pitch: "Axe — orienter la vue verticalement",
  v_view_pitch_up: "Regarder vers le haut",
  v_view_pitch_down: "Regarder vers le bas",
  v_view_yaw: "Axe — orienter la vue horizontalement",
  v_view_yaw_left: "Regarder à gauche",
  v_view_yaw_right: "Regarder à droite",
  v_view_zoom_in: "Zoom avant",
  v_view_zoom_out: "Zoom arrière",
  // ── Siège et modes : seat_general, spaceship_quantum ───────────────────
  v_toggle_quantum_mode: "Mode quantique",
  v_toggle_qdrive_engagement: "Enclencher le saut quantique",
  v_toggle_scan_mode: "Mode scan",
  v_toggle_mining_mode: "Mode minage",
  v_enter_remote_turret_1: "Entrer en tourelle",
  // ── Hors périmètre Lite, mais affiché dans l'aperçu ────────────────────
  v_lights: "Feux du vaisseau",
  v_self_destruct: "Autodestruction",
  v_toggle_all_doors: "Ouvrir / fermer les portes",
  v_toggle_all_doorlocks: "Verrouiller / déverrouiller les portes",
  v_cooler_throttle_up: "Augmenter le refroidissement",
  v_cooler_throttle_down: "Réduire le refroidissement",
  v_starmap: "Carte stellaire",
  v_target_toggle_pin_index_1: "Épingler la cible 1",
  v_shield_raise_level_forward: "Renforcer le bouclier avant",
  v_shield_raise_level_back: "Renforcer le bouclier arrière",
  v_shield_reset_level: "Réinitialiser les boucliers",
  v_weapon_countermeasure_decoy_launch: "Larguer un leurre",
  v_weapon_countermeasure_noise_launch: "Brouillage (chaff)"
}, F = {
  agree: "approuver",
  angry: "colère",
  atease: "repos",
  attention: "garde-à-vous",
  blah: "blabla",
  bored: "ennui",
  bow: "s'incliner",
  burp: "roter",
  cheer: "acclamer",
  chicken: "poule",
  clap: "applaudir",
  come: "venir",
  cry: "pleurer",
  cs_forward: "signal — en avant",
  cs_left: "signal — à gauche",
  cs_no: "signal — non",
  cs_right: "signal — à droite",
  cs_stop: "signal — stop",
  cs_yes: "signal — oui",
  dance: "danser",
  disagree: "désapprouver",
  failure: "échec",
  flex: "montrer ses muscles",
  flirt: "flirter",
  gasp: "surprise",
  gloat: "jubiler",
  greet: "saluer",
  laugh: "rire",
  point: "pointer du doigt",
  rude: "geste grossier",
  salute: "salut militaire",
  sit: "s'asseoir",
  sleep: "dormir",
  smell: "renifler",
  taunt: "narguer",
  threaten: "menacer",
  wait: "attendre",
  wave: "faire signe",
  whistle: "siffler"
};
function X(e) {
  return e.label ?? J(e.action);
}
function J(e) {
  const t = D[e];
  if (t) return t;
  const r = e.startsWith("emote_") ? F[e.slice(6)] : void 0;
  return r ? `Émote — ${r}` : e;
}
function Le(e) {
  return e in D || e.startsWith("emote_") && e.slice(6) in F;
}
const Y = {
  default: "Général",
  lights_controller: "Éclairage",
  mapui: "Carte",
  mining: "Minage (à pied)",
  player: "À pied",
  player_choice: "Menu d'interaction",
  player_emotes: "Émotes",
  player_input_optical_tracking: "Suivi de tête et VR",
  prone: "À plat ventre",
  RemoteRigidEntityController: "Contrôle à distance",
  seat_general: "Siège & systèmes",
  server_renderer: "Rendu serveur",
  spaceship_auto_weapons: "Armes automatiques",
  spaceship_defensive: "Contre-mesures",
  spaceship_general: "Vaisseau — général",
  spaceship_hud: "Interface (HUD)",
  spaceship_mining: "Minage",
  spaceship_missiles: "Missiles",
  spaceship_movement: "Pilotage",
  spaceship_power: "Énergie",
  spaceship_quantum: "Saut quantique",
  spaceship_radar: "Radar",
  spaceship_scanning: "Scan",
  spaceship_targeting: "Ciblage",
  spaceship_targeting_advanced: "Ciblage avancé",
  spaceship_view: "Vue",
  spectator: "Spectateur",
  stopwatch: "Chronomètre",
  tractor_beam: "Rayon tracteur",
  turret_advanced: "Tourelles — avancé",
  turret_movement: "Tourelles — mouvement",
  vehicle_driver: "Conduite",
  vehicle_general: "Véhicule — général",
  vehicle_mfd: "Écrans MFD",
  view_director_mode: "Mode réalisateur",
  zero_gravity_eva: "EVA (apesanteur)"
};
function ee(e) {
  return Y[e] ?? e;
}
const te = {
  tap: { key: "activation.tap", kind: "tap" },
  hold: { key: "activation.hold", kind: "hold" },
  hold_toggle: { key: "activation.holdToggle", kind: "hold" },
  hold_no_retrigger: { key: "activation.hold", kind: "hold" },
  double_tap: { key: "activation.doubleTap", kind: "tap" },
  double_tap_nonblocking: { key: "activation.doubleTap", kind: "tap" },
  delayed_press: { key: "activation.delayedPress", kind: "hold" },
  delayed_press_medium: { key: "activation.delayedPress", kind: "hold" },
  delayed_hold: { key: "activation.delayedHold", kind: "hold" },
  delayed_hold_long: { key: "activation.delayedHold", kind: "hold" },
  delayed_hold_no_retrigger: { key: "activation.delayedHold", kind: "hold" },
  smart_toggle: { key: "activation.smartToggle", kind: "other" }
};
function Oe(e, t, r) {
  const a = t ? Number.parseInt(t, 10) : NaN;
  if (a > 1)
    return {
      label: a === 2 ? r("activation.doubleTap") : `${r("activation.multiTap")} ×${a}`,
      kind: "tap"
    };
  if (!e || e === "press")
    return null;
  const s = te[e];
  return s ? { label: r(s.key), kind: s.kind } : { label: e, kind: "other" };
}
class Re {
  pairs;
  constructor(t) {
    this.pairs = new Set(
      (t ?? []).flatMap(([r, a]) => [`${r}|${a}`, `${a}|${r}`])
    );
  }
  canCollide(t, r) {
    return this.pairs.size === 0 ? !0 : this.pairs.has(`${t}|${r}`);
  }
}
function C(e) {
  return `${e.actionmap}/${e.action}/${e.input_raw}`;
}
function E(e, t) {
  const r = C(e);
  return t.has(r) ? t.get(r) ?? null : e.control && e.control.trim() !== "" ? e.input_raw : null;
}
function re(e, t) {
  return E(e, t) !== null;
}
function Te(e, t, r) {
  const a = /* @__PURE__ */ new Map();
  for (const o of e) {
    const i = E(o, t);
    if (i === null) continue;
    const u = a.get(i);
    u ? u.push(o) : a.set(i, [o]);
  }
  const s = /* @__PURE__ */ new Set();
  for (const [, o] of a)
    for (const i of o)
      o.filter(
        (p) => p !== i && r.canCollide(i.context, p.context)
      ).length > 0 && s.add(C(i));
  return { byToken: a, rules: r, flagged: s };
}
function ze(e, t, r) {
  const a = E(e, t);
  if (a === null) return [];
  const s = C(e);
  return (r.byToken.get(a) ?? []).filter(
    (o) => C(o) !== s && r.rules.canCollide(e.context, o.context)
  );
}
function ae(e, t, r) {
  return r.flagged.has(C(e));
}
const ne = ["x", "y", "z", "rotx", "roty", "rotz", "slider1", "slider2"], se = ["up", "right", "down", "left"];
function Me(e, t) {
  switch (e) {
    case "buttons":
      return t("control.buttons");
    case "axes":
      return t("control.axes");
    case "hats":
      return t("control.hats");
  }
}
function Ee(e, t) {
  const r = [];
  for (let a = 1; a <= e.buttons; a++)
    r.push({
      value: `button${a}`,
      label: `${t("control.button")} ${a}`,
      group: "buttons"
    });
  for (const a of ne.slice(0, e.axes))
    r.push({
      value: a,
      label: `${t("control.axis")} ${a}`,
      group: "axes"
    });
  for (let a = 1; a <= e.povs; a++)
    for (const s of se)
      r.push({
        value: `hat${a}_${s}`,
        label: `${t("control.hat")} ${a} — ${j(s, t)}`,
        group: "hats"
      });
  return r;
}
function Be(e, t) {
  const r = /^button(\d+)$/.exec(e);
  if (r) return `${t("control.button")} ${r[1]}`;
  const a = /^hat(\d+)_(\w+)$/.exec(e);
  if (a)
    return `${t("control.hat")} ${a[1]} — ${j(a[2], t)}`;
  const s = /^slider(\d+)$/.exec(e);
  return s ? `${t("control.slider")} ${s[1]}` : `${t("control.axis")} ${e}`;
}
function j(e, t) {
  switch (e) {
    case "up":
      return t("control.up");
    case "down":
      return t("control.down");
    case "left":
      return t("control.left");
    case "right":
      return t("control.right");
    default:
      return e;
  }
}
function qe(e, t) {
  const a = e.filter((o) => o.category === t.category).findIndex(
    (o) => o.instance_guid === t.instance_guid
  );
  return `${t.category === "gamepad" ? "gp" : "js"}${a + 1}`;
}
const V = {
  query: "",
  unassignedOnly: !1,
  conflictsOnly: !1,
  editableOnly: !1
};
function I(e) {
  return e.query.trim() !== "" || e.unassignedOnly || e.conflictsOnly || e.editableOnly;
}
function P(e) {
  switch (e.input_raw.slice(0, 2)) {
    case "kb":
    case "mo":
      return "desk";
    case "gp":
      return "gamepad";
    case "js":
      return "joystick";
    default:
      return null;
  }
}
function oe(e, t, r, a, s) {
  const o = B(t.query);
  return e.filter((i) => {
    const u = re(i, a);
    return r !== "all" && u && P(i) !== r || t.unassignedOnly && u || t.conflictsOnly && !ae(i, a, s) || t.editableOnly && i.lock ? !1 : o === "" ? !0 : [
      X(i),
      i.action,
      i.description ?? "",
      i.input_raw,
      i.control ?? "",
      ee(i.actionmap),
      i.actionmap
    ].some((p) => B(p).includes(o));
  });
}
function B(e) {
  return e.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
const De = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  NO_FILTERS: V,
  apply: oe,
  isFiltering: I,
  modeOf: P
}, Symbol.toStringTag, { value: "Module" })), ie = {
  ShiftLeft: "lshift",
  ShiftRight: "rshift",
  ControlLeft: "lctrl",
  ControlRight: "rctrl",
  AltLeft: "lalt",
  AltRight: "ralt"
}, le = {
  Space: "space",
  Enter: "enter",
  Escape: "escape",
  Tab: "tab",
  Backspace: "backspace",
  CapsLock: "capslock",
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  Insert: "insert",
  Delete: "delete",
  Home: "home",
  End: "end",
  PageUp: "pgup",
  PageDown: "pgdn",
  Minus: "minus",
  Equal: "equals",
  BracketLeft: "lbracket",
  BracketRight: "rbracket",
  Semicolon: "semicolon",
  Quote: "apostrophe",
  Backquote: "tilde",
  Backslash: "backslash",
  Comma: "comma",
  Period: "period",
  Slash: "slash",
  NumpadAdd: "np_add",
  NumpadSubtract: "np_subtract",
  NumpadMultiply: "np_multiply",
  NumpadDivide: "np_divide",
  NumpadDecimal: "np_period",
  NumpadEnter: "np_enter",
  PrintScreen: "print",
  ScrollLock: "scrolllock",
  Pause: "pause"
}, ce = {
  0: "mouse1",
  1: "mouse3",
  2: "mouse2",
  3: "mouse4",
  4: "mouse5"
};
function Fe(e) {
  return ie[e] ?? null;
}
function ue(e, t) {
  return { token: `kb1_${e ? `${e}+${t}` : t}`, modifier: e, control: t };
}
function je(e, t) {
  if (t.length > 1)
    return { ok: !1, error: { kind: "too_many_modifiers" } };
  const r = de(e);
  return r ? { ok: !0, value: ue(t[0] ?? null, r) } : { ok: !1, error: { kind: "unsupported", code: e } };
}
function Ve(e, t) {
  if (t.length > 1)
    return { ok: !1, error: { kind: "too_many_modifiers" } };
  const r = ce[e];
  return r ? { ok: !0, value: H(t[0] ?? null, r) } : { ok: !1, error: { kind: "unsupported", code: `mouse${e}` } };
}
function Ie(e, t) {
  if (t.length > 1)
    return { ok: !1, error: { kind: "too_many_modifiers" } };
  if (e === 0)
    return { ok: !1, error: { kind: "unsupported", code: "mwheel" } };
  const r = e < 0 ? "mwheel_up" : "mwheel_down";
  return { ok: !0, value: H(t[0] ?? null, r) };
}
function H(e, t) {
  return { token: `mo1_${e ? `${e}+${t}` : t}`, modifier: e, control: t };
}
function de(e) {
  return /^Key[A-Z]$/.test(e) ? e.slice(3).toLowerCase() : /^Digit[0-9]$/.test(e) ? e.slice(5) : /^F([1-9]|1[0-2])$/.test(e) ? e.toLowerCase() : /^Numpad[0-9]$/.test(e) ? `np_${e.slice(6)}` : le[e] ?? null;
}
function ve(e) {
  return /^[a-z]$/.test(e) ? `Key${e.toUpperCase()}` : /^[0-9]$/.test(e) ? `Digit${e}` : null;
}
function Pe() {
  const [e, t] = f(null);
  return L(() => {
    let r = !1;
    const a = navigator.keyboard;
    if (a?.getLayoutMap)
      return a.getLayoutMap().then((s) => {
        r || t(s);
      }).catch(() => {
      }), () => {
        r = !0;
      };
  }, []), e;
}
const pe = {
  lshift: "key.lshift",
  rshift: "key.rshift",
  lctrl: "key.lctrl",
  rctrl: "key.rctrl",
  lalt: "key.lalt",
  ralt: "key.ralt",
  space: "key.space",
  enter: "key.enter",
  escape: "key.escape",
  tab: "key.tab",
  backspace: "key.backspace",
  capslock: "key.capslock",
  up: "key.up",
  down: "key.down",
  left: "key.left",
  right: "key.right",
  insert: "key.insert",
  delete: "key.delete",
  home: "key.home",
  end: "key.end",
  pgup: "key.pgup",
  pgdn: "key.pgdn",
  mouse1: "key.mouse1",
  mouse2: "key.mouse2",
  mouse3: "key.mouse3",
  mouse4: "key.mouse4",
  mouse5: "key.mouse5",
  mwheel_up: "key.mwheelUp",
  mwheel_down: "key.mwheelDown"
};
function Z(e, t) {
  const r = pe[e];
  return r ? t(r) : e.startsWith("np_") ? `${t("key.numpad")} ${e.slice(3)}` : e.toUpperCase();
}
function me(e, t, r) {
  if (t && /^[a-z0-9]$/.test(e)) {
    const a = ve(e), s = a ? t.get(a) : void 0;
    if (s && /^[a-z0-9]$/i.test(s)) return s.toUpperCase();
  }
  return Z(e, r);
}
function He(e, t, r) {
  const a = me(e.control, r ?? null, t);
  return e.modifier ? `${Z(e.modifier, t)} + ${a}` : a;
}
function Ze(e, t) {
  switch (e.kind) {
    case "too_many_modifiers":
      return t("capture.tooManyModifiers");
    case "unsupported":
      return `${t("capture.unsupported")} (${e.code})`;
  }
}
const U = K((e) => e);
function Ue({
  translate: e,
  children: t
}) {
  const r = W(() => e, [e]);
  return /* @__PURE__ */ n(U.Provider, { value: r, children: t });
}
function y() {
  return G(U);
}
function Ke(e, t) {
  const [r, a] = f(null), [s, o] = f(!1), [i, u] = f(null), p = e.map((d) => d.instance_guid).join("|");
  return L(() => {
    if (!t || p === "") {
      o(!1);
      return;
    }
    let d = !1;
    u(null), o(!1);
    const h = _.startCapture(p.split("|"));
    h.then(
      () => !d && o(!0),
      (m) => !d && u(String(m))
    );
    const b = window.setInterval(async () => {
      try {
        const m = await _.pollCapture();
        !d && m && a(m);
      } catch (m) {
        d || u(String(m));
      }
    }, 60);
    return () => {
      d = !0, window.clearInterval(b), h.then((m) => _.stopCapture(m)).catch(() => {
      });
    };
  }, [p, t]), {
    last: r,
    listening: s,
    error: i,
    // L'oubli doit aussi porter côté Rust : le thread garde son relevé, et le
    // sondage suivant le restaurerait aussitôt.
    reset: () => {
      a(null), _.clearCapture().catch(() => {
      });
    }
  };
}
function Ge(e, t, r) {
  if (!e) return null;
  const a = t.find((s) => s.instance_guid === e.guid);
  return a ? `${r(a)}_${e.control}` : null;
}
function We({
  profilePath: e,
  mode: t,
  onModeChange: r,
  listening: a,
  deviceCount: s,
  captureError: o,
  probe: i,
  onClearProbe: u,
  onRestored: p
}) {
  const d = y(), [h, b] = f([]), [m, k] = f(!1), [O, x] = f(!1), [w, N] = f(null);
  async function $() {
    try {
      b(await _.listBackups());
    } catch {
    }
  }
  L(() => {
    $();
  }, []);
  async function A() {
    x(!0);
    try {
      await _.createBackup(e), N(d("backup.created")), await $();
    } catch (l) {
      N(String(l));
    } finally {
      x(!1);
    }
  }
  const S = [
    { id: "all", label: "filter.mode.all" },
    { id: "desk", label: "filter.mode.desk" },
    { id: "gamepad", label: "filter.mode.gamepad" },
    { id: "joystick", label: "filter.mode.joystick" }
  ];
  return /* @__PURE__ */ c("div", { className: "space-y-2", children: [
    /* @__PURE__ */ c("div", { className: "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2", children: [
      /* @__PURE__ */ c("div", { className: "-mx-1 flex max-w-full items-center gap-1 overflow-x-auto overflow-y-hidden px-1", children: [
        /* @__PURE__ */ n("span", { className: "mr-1 shrink-0 text-xs font-medium text-[var(--text-tertiary)]", children: d("filter.mode") }),
        S.map((l) => /* @__PURE__ */ n(
          "button",
          {
            onClick: () => r(l.id),
            className: "shrink-0 whitespace-nowrap rounded-[var(--radius-control)] px-2.5 py-1 text-xs font-medium transition-colors " + (t === l.id ? "bg-accent text-white" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"),
            children: d(l.label)
          },
          l.id
        ))
      ] }),
      /* @__PURE__ */ c("div", { className: "flex flex-wrap items-center gap-3 sm:ml-auto", children: [
        /* @__PURE__ */ n(
          fe,
          {
            listening: a,
            count: s,
            error: o,
            probe: i,
            onClear: u
          }
        ),
        /* @__PURE__ */ c("div", { className: "relative", children: [
          /* @__PURE__ */ c("div", { className: "flex items-center rounded-[var(--radius-control)] border border-[var(--border-default)]", children: [
            /* @__PURE__ */ n(
              "button",
              {
                onClick: () => {
                  A();
                },
                disabled: O,
                className: "rounded-l-md px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:text-[var(--text-disabled)]",
                children: d("backup.create")
              }
            ),
            /* @__PURE__ */ c(
              "button",
              {
                onClick: () => k((l) => !l),
                className: "border-l border-[var(--border-default)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]",
                title: d("backup.title"),
                children: [
                  h.length,
                  " ▾"
                ]
              }
            )
          ] }),
          m && /* @__PURE__ */ n(
            he,
            {
              profilePath: e,
              backups: h,
              onClose: () => k(!1),
              onChanged: async () => {
                await $(), p();
              }
            }
          )
        ] }),
        /* @__PURE__ */ n(_e, {})
      ] })
    ] }),
    w && /* @__PURE__ */ n("p", { className: "rounded-[var(--radius-control)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs text-[var(--text-accent)]", children: w })
  ] });
}
function fe({
  listening: e,
  count: t,
  error: r,
  probe: a,
  onClear: s
}) {
  const o = y();
  return r ? /* @__PURE__ */ n("span", { className: "text-xs text-[var(--danger-text)]", title: r, children: o("probe.stopped") }) : a ? /* @__PURE__ */ c("span", { className: "flex items-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--accent-soft)] px-2 py-1 text-xs text-[var(--text-accent)]", children: [
    /* @__PURE__ */ n("span", { className: "font-mono font-semibold", children: a.device }),
    /* @__PURE__ */ n("span", { children: a.control }),
    /* @__PURE__ */ n("span", { className: "text-[var(--text-accent)]", children: "·" }),
    /* @__PURE__ */ n("span", { children: a.matches === 0 ? o("probe.noMatch") : `${a.matches} ${o(
      a.matches > 1 ? "probe.matchMany" : "probe.matchOne"
    )}` }),
    /* @__PURE__ */ n(
      "button",
      {
        onClick: s,
        className: "ml-1 text-[var(--text-accent)] hover:text-[var(--accent-hover)]",
        children: o("probe.clear")
      }
    )
  ] }) : /* @__PURE__ */ c(
    "span",
    {
      className: "flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]",
      title: o("probe.idle"),
      children: [
        /* @__PURE__ */ n(
          "span",
          {
            className: "inline-block h-1.5 w-1.5 rounded-full " + (e ? "bg-[var(--accent-soft)]0" : "bg-[var(--border-default)]")
          }
        ),
        t,
        " ",
        o(t > 1 ? "probe.deviceMany" : "probe.deviceOne")
      ]
    }
  );
}
function _e() {
  const e = y(), [t, r] = f(!1);
  return /* @__PURE__ */ c("div", { className: "relative", children: [
    /* @__PURE__ */ n(
      "button",
      {
        onClick: () => r((a) => !a),
        className: "flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border-default)] text-xs text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]",
        title: e("scope.title"),
        children: "?"
      }
    ),
    t && /* @__PURE__ */ c(M, { children: [
      /* @__PURE__ */ n("div", { className: "fixed inset-0 z-10", onClick: () => r(!1) }),
      /* @__PURE__ */ c("div", { className: "absolute right-0 z-20 mt-2 w-80 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 shadow-[var(--shadow-2)]", children: [
        /* @__PURE__ */ n("h4", { className: "text-xs font-semibold text-[var(--text-primary)]", children: e("scope.title") }),
        /* @__PURE__ */ n("p", { className: "mt-1 text-xs text-[var(--text-secondary)]", children: e("scope.editable") }),
        /* @__PURE__ */ n("p", { className: "mt-2 text-xs text-[var(--text-secondary)]", children: e("scope.defaults") }),
        /* @__PURE__ */ n("p", { className: "mt-2 text-xs text-[var(--danger-text)]", children: e("scope.closeGame") })
      ] })
    ] })
  ] });
}
function he({
  profilePath: e,
  backups: t,
  onClose: r,
  onChanged: a
}) {
  const s = y(), [o, i] = f(null), u = Q(null);
  async function p() {
    if (!o) return;
    const { backup: d, action: h } = o;
    i(null);
    try {
      h === "restore" ? await _.restoreBackup(e, d.path) : await _.deleteBackup(d.path), a();
    } catch {
    }
    r();
  }
  return /* @__PURE__ */ c(M, { children: [
    /* @__PURE__ */ n("div", { className: "fixed inset-0 z-10", onClick: r }),
    /* @__PURE__ */ c(
      "div",
      {
        ref: u,
        className: "absolute right-0 z-20 mt-1 w-72 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] shadow-[var(--shadow-2)]",
        children: [
          /* @__PURE__ */ n("p", { className: "border-b border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-tertiary)]", children: s("backup.hint") }),
          t.length === 0 ? /* @__PURE__ */ n("p", { className: "px-3 py-4 text-center text-xs text-[var(--text-tertiary)]", children: s("backup.empty") }) : /* @__PURE__ */ n("ul", { className: "max-h-64 divide-y divide-[var(--border-subtle)] overflow-y-auto", children: t.map((d) => /* @__PURE__ */ c("li", { className: "px-3 py-2", children: [
            /* @__PURE__ */ n("p", { className: "text-xs text-[var(--text-primary)]", children: q(d.timestamp) }),
            /* @__PURE__ */ c("div", { className: "mt-1 flex gap-2", children: [
              /* @__PURE__ */ n(
                "button",
                {
                  onClick: () => i({ backup: d, action: "restore" }),
                  className: "text-xs font-medium text-[var(--text-accent)] hover:text-[var(--accent-hover)]",
                  children: s("backup.restore")
                }
              ),
              /* @__PURE__ */ n(
                "button",
                {
                  onClick: () => i({ backup: d, action: "delete" }),
                  className: "text-xs text-[var(--text-tertiary)] hover:text-[var(--danger-text)]",
                  children: s("backup.delete")
                }
              )
            ] })
          ] }, d.path)) })
        ]
      }
    ),
    o && /* @__PURE__ */ n(
      "div",
      {
        className: "fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[var(--scrim)] p-4 sm:p-8",
        onClick: () => i(null),
        children: /* @__PURE__ */ c(
          "div",
          {
            className: "w-full max-w-md rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-5 shadow-[var(--shadow-2)]",
            onClick: (d) => d.stopPropagation(),
            children: [
              /* @__PURE__ */ n("h3", { className: "text-sm font-semibold text-[var(--text-primary)]", children: s(
                o.action === "delete" ? "backup.confirmDeleteTitle" : "backup.confirmTitle"
              ) }),
              /* @__PURE__ */ n("p", { className: "mt-2 text-sm text-[var(--text-secondary)]", children: q(o.backup.timestamp) }),
              /* @__PURE__ */ n(
                "p",
                {
                  className: "mt-2 text-sm " + (o.action === "delete" ? "text-[var(--danger-text)]" : "text-[var(--text-tertiary)]"),
                  children: s(
                    o.action === "delete" ? "backup.confirmDeleteBody" : "backup.confirmKept"
                  )
                }
              ),
              /* @__PURE__ */ c("div", { className: "mt-4 flex justify-end gap-2", children: [
                /* @__PURE__ */ n(
                  "button",
                  {
                    onClick: () => i(null),
                    className: "rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-2)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)]",
                    children: s("save.cancel")
                  }
                ),
                /* @__PURE__ */ n(
                  "button",
                  {
                    onClick: () => {
                      p();
                    },
                    className: "rounded-[var(--radius-control)] px-3 py-1.5 text-sm font-medium text-white " + (o.action === "delete" ? "bg-[var(--danger)] hover:bg-[var(--danger)]" : "bg-accent hover:bg-[var(--accent-hover)]"),
                    children: s(
                      o.action === "delete" ? "backup.delete" : "backup.restore"
                    )
                  }
                )
              ] })
            ]
          }
        )
      }
    )
  ] });
}
function q(e) {
  const t = Number(e);
  return Number.isFinite(t) ? new Date(t).toLocaleString(void 0, {
    dateStyle: "medium",
    timeStyle: "short"
  }) : e;
}
const ge = {
  sm: "h-[var(--h-control-sm)] px-[var(--sp-5)] text-[length:var(--fs-body-sm)]",
  md: "h-[var(--h-control)] px-[var(--sp-6)] text-[length:var(--fs-body)]",
  lg: "h-[var(--h-control-lg)] px-[var(--sp-7)] text-[length:var(--fs-body)]"
}, be = {
  primary: "border border-transparent bg-accent text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)] hover:shadow-[var(--glow-soft)] active:bg-[var(--accent-press)] active:shadow-none",
  secondary: "border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]",
  ghost: "border border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
};
function R({
  variant: e = "primary",
  size: t = "md",
  className: r = "",
  ...a
}) {
  return /* @__PURE__ */ n(
    "button",
    {
      className: `inline-flex items-center justify-center gap-[var(--sp-3)] rounded-[var(--radius-control)] font-medium leading-none transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] focus-visible:shadow-[var(--ring-focus)] active:scale-[var(--press-scale)] disabled:pointer-events-none disabled:opacity-[0.42] ${ge[t]} ${be[e]} ${r}`,
      ...a
    }
  );
}
const xe = "cursor-pointer transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:-translate-y-px hover:border-[var(--border-accent)]";
function ye() {
  const e = "pointer-events-none absolute h-[10px] w-[10px] border-[var(--border-hud)]";
  return /* @__PURE__ */ c(M, { children: [
    /* @__PURE__ */ n("span", { "aria-hidden": !0, className: `${e} left-0 top-0 border-l-2 border-t-2` }),
    /* @__PURE__ */ n("span", { "aria-hidden": !0, className: `${e} right-0 top-0 border-r-2 border-t-2` }),
    /* @__PURE__ */ n("span", { "aria-hidden": !0, className: `${e} bottom-0 left-0 border-b-2 border-l-2` }),
    /* @__PURE__ */ n("span", { "aria-hidden": !0, className: `${e} bottom-0 right-0 border-b-2 border-r-2` })
  ] });
}
function ke({
  variant: e = "standard",
  interactive: t = !1,
  className: r = "",
  children: a,
  ...s
}) {
  const o = t ? xe : "";
  return e === "hud" ? /* @__PURE__ */ c(
    "div",
    {
      className: `relative rounded-[var(--radius-xs)] border border-[var(--border-hud)] bg-[var(--surface-1)] p-[var(--pad-card)] ${o} ${r}`,
      ...s,
      children: [
        /* @__PURE__ */ n(ye, {}),
        a
      ]
    }
  ) : /* @__PURE__ */ n(
    "div",
    {
      className: `rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-[var(--pad-card)] shadow-[var(--shadow-1)] ${o} ${r}`,
      ...s,
      children: a
    }
  );
}
function we({ selected: e = !1, className: t = "", ...r }) {
  return /* @__PURE__ */ n(
    "button",
    {
      type: "button",
      "aria-pressed": e,
      className: `inline-flex items-center gap-[var(--sp-2)] rounded-[var(--radius-pill)] border px-[var(--sp-5)] py-[var(--sp-2)] text-[length:var(--fs-body-sm)] font-medium leading-none transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] focus-visible:shadow-[var(--ring-focus)] ${e ? "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--text-accent)]" : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:border-[var(--border-default)] hover:text-[var(--text-primary)]"} ${t}`,
      ...r
    }
  );
}
function Qe({
  filters: e,
  onChange: t,
  shown: r,
  total: a,
  conflictCount: s,
  unassignedCount: o,
  showEditableFilter: i = !0
}) {
  const u = y();
  return /* @__PURE__ */ c("div", { className: "flex flex-wrap items-center gap-x-4 gap-y-2", children: [
    /* @__PURE__ */ n(
      "input",
      {
        type: "search",
        value: e.query,
        onChange: (p) => t({ ...e, query: p.target.value }),
        placeholder: u("filter.placeholder"),
        className: "min-w-56 flex-1 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-2)] px-[var(--sp-6)] py-[var(--sp-4)] text-[length:var(--fs-body-sm)] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:border-[var(--border-accent)] focus-visible:shadow-[var(--ring-focus)] focus:outline-none"
      }
    ),
    /* @__PURE__ */ n(
      T,
      {
        active: e.unassignedOnly,
        count: o,
        onClick: () => t({ ...e, unassignedOnly: !e.unassignedOnly }),
        children: u("filter.unassigned")
      }
    ),
    /* @__PURE__ */ n(
      T,
      {
        active: e.conflictsOnly,
        count: s,
        warn: !0,
        onClick: () => t({ ...e, conflictsOnly: !e.conflictsOnly }),
        children: u("filter.conflicts")
      }
    ),
    i && /* @__PURE__ */ n(
      T,
      {
        active: e.editableOnly,
        onClick: () => t({ ...e, editableOnly: !e.editableOnly }),
        children: u("filter.editableOnly")
      }
    ),
    /* @__PURE__ */ n("span", { className: "ml-auto whitespace-nowrap rounded-[var(--radius-pill)] border border-[var(--border-subtle)] px-[var(--sp-5)] py-[var(--sp-2)] text-[length:var(--fs-caption)] text-[var(--text-tertiary)]", children: r === a ? `${a}` : `${r} / ${a}` }),
    I(e) && /* @__PURE__ */ n(
      "button",
      {
        onClick: () => t(V),
        className: "whitespace-nowrap text-[length:var(--fs-caption)] font-medium text-[var(--text-accent)] hover:text-[var(--accent-hover)]",
        children: u("filter.showAll")
      }
    )
  ] });
}
function T({
  active: e,
  count: t,
  warn: r,
  onClick: a,
  children: s
}) {
  const o = t === 0;
  return /* @__PURE__ */ c(
    we,
    {
      selected: e,
      onClick: a,
      disabled: o && !e,
      className: `${o && !e ? "opacity-[0.42]" : ""} ${r && e ? "!border-[var(--danger)] !bg-[var(--danger-soft)] !text-[var(--danger-text)]" : ""}`,
      children: [
        s,
        t !== void 0 && // `border-current` plutôt qu'une couleur fixe : le compteur doit se
        // détacher du libellé quel que soit l'état du Tag (actif, alerte,
        // survolé) sans dupliquer sa palette de couleurs ici.
        /* @__PURE__ */ n("span", { className: "tabular-nums rounded-full border border-current/30 px-[var(--sp-3)] text-[length:var(--fs-caption)] opacity-80", children: t })
      ]
    }
  );
}
function Xe({
  profilePath: e,
  profiles: t,
  onSelectProfile: r,
  onBrowse: a,
  onRefresh: s,
  onChanged: o
}) {
  const i = y(), [u, p] = f(null), [d, h] = f([]), [b, m] = f(null), [k, O] = f(null), [x, w] = f(!1);
  L(() => {
    let l = !1;
    return (async () => {
      try {
        const g = await _.getSettings();
        l || p(g);
      } catch (g) {
        l || m(String(g));
      }
      if (e)
        try {
          const g = await _.listGameLanguages(e);
          l || h(g);
        } catch (g) {
          l || m(String(g));
        }
    })(), () => {
      l = !0;
    };
  }, [e]);
  async function N(l) {
    p(l);
    try {
      await _.setSettings(l), O(i("settings.saved")), m(null), o();
    } catch (g) {
      m(String(g));
    }
  }
  async function $() {
    if (!(!s || x)) {
      w(!0), m(null);
      try {
        await s();
      } catch (l) {
        m(String(l));
      } finally {
        w(!1);
      }
    }
  }
  if (!u)
    return /* @__PURE__ */ n("p", { className: "text-[length:var(--fs-body-sm)] text-[var(--text-tertiary)]", children: i("settings.loading") });
  const A = "min-w-0 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-2)] px-[var(--sp-6)] py-[var(--sp-4)] text-[length:var(--fs-body-sm)] text-[var(--text-primary)] focus:border-[var(--border-accent)] focus-visible:shadow-[var(--ring-focus)] focus:outline-none", S = e !== null && !t.some((l) => l.path === e);
  return /* @__PURE__ */ c("div", { className: "space-y-[var(--sp-6)]", children: [
    /* @__PURE__ */ c(z, { title: i("profile.title"), hint: i("profile.hint"), children: [
      /* @__PURE__ */ c("div", { className: "flex flex-wrap items-center gap-[var(--sp-4)]", children: [
        t.length > 0 || S ? /* @__PURE__ */ c(
          "select",
          {
            className: `max-w-full flex-1 sm:flex-none ${A}`,
            value: e ?? "",
            onChange: (l) => r(l.target.value),
            children: [
              S && /* @__PURE__ */ n("option", { value: e, children: i("profile.manual") }),
              t.map((l) => /* @__PURE__ */ n("option", { value: l.path, children: Ne(l) }, l.path))
            ]
          }
        ) : /* @__PURE__ */ n("p", { className: "text-[length:var(--fs-body-sm)] text-[var(--text-tertiary)]", children: i("profile.none") }),
        /* @__PURE__ */ n(R, { variant: "secondary", size: "sm", onClick: a, className: "shrink-0", children: i("profile.browse") }),
        s && /* @__PURE__ */ n(
          R,
          {
            variant: "secondary",
            size: "sm",
            onClick: () => {
              $();
            },
            disabled: x,
            className: "shrink-0",
            children: i(x ? "profile.refreshing" : "profile.rescan")
          }
        )
      ] }),
      e && /* @__PURE__ */ n("p", { className: "technical mt-[var(--sp-4)] break-all text-[var(--text-disabled)]", children: e })
    ] }),
    /* @__PURE__ */ n(
      z,
      {
        title: i("settings.gameLanguage"),
        hint: i("settings.gameLanguageHint"),
        children: d.length === 0 ? /* @__PURE__ */ n("p", { className: "text-[length:var(--fs-body-sm)] text-[var(--text-tertiary)]", children: i("settings.noLanguages") }) : /* @__PURE__ */ n(
          "select",
          {
            className: `w-full max-w-sm ${A}`,
            value: u.game_language,
            onChange: (l) => {
              N({ ...u, game_language: l.target.value });
            },
            children: d.map((l) => /* @__PURE__ */ n("option", { value: l.id, children: l.label }, l.id))
          }
        )
      }
    ),
    /* @__PURE__ */ c(
      z,
      {
        title: i("settings.uiLanguage"),
        hint: i("settings.uiLanguageHint"),
        children: [
          /* @__PURE__ */ n("div", { className: "flex gap-[var(--sp-4)]", children: [
            { id: "fr", label: "Français" },
            { id: "en", label: "English" }
          ].map((l) => /* @__PURE__ */ n(
            R,
            {
              size: "sm",
              variant: u.ui_language === l.id ? "primary" : "secondary",
              onClick: () => {
                N({ ...u, ui_language: l.id });
              },
              children: l.label
            },
            l.id
          )) }),
          /* @__PURE__ */ n("p", { className: "mt-[var(--sp-4)] text-[length:var(--fs-caption)] text-[var(--text-tertiary)]", children: i("settings.installHint") })
        ]
      }
    ),
    k && /* @__PURE__ */ n("p", { className: "text-[length:var(--fs-body-sm)] text-[var(--success-text)]", children: k }),
    b && /* @__PURE__ */ n("p", { className: "text-[length:var(--fs-body-sm)] text-[var(--danger-text)]", children: b })
  ] });
}
function Ne(e) {
  const t = $e(e.path) ?? e.path;
  return `${e.channel} — ${t}`;
}
function $e(e) {
  const t = /(?:^|[\\/])StarCitizen(?=[\\/]|$)/gi;
  let r = null, a;
  for (; (a = t.exec(e)) !== null; )
    r = a;
  return r ? e.slice(0, r.index + r[0].length) : null;
}
function z({
  title: e,
  hint: t,
  children: r
}) {
  return /* @__PURE__ */ c(ke, { children: [
    /* @__PURE__ */ n("h3", { className: "text-[length:var(--fs-body)] font-semibold text-[var(--text-primary)]", children: e }),
    /* @__PURE__ */ n("p", { className: "mb-[var(--sp-4)] mt-[var(--sp-1)] text-[length:var(--fs-caption)] text-[var(--text-tertiary)]", children: t }),
    r
  ] });
}
export {
  ne as AXES,
  Re as ContextRules,
  We as EditorToolbar,
  Qe as FilterBar,
  V as NO_FILTERS,
  Xe as SettingsPanel,
  Ue as TranslationProvider,
  J as actionLabel,
  Oe as activationBadge,
  _ as api,
  oe as apply,
  X as bindingLabel,
  ue as build,
  Ze as captureErrorMessage,
  Ge as capturedToken,
  ee as categoryLabel,
  Be as controlLabel,
  Ee as controlsFor,
  He as describe,
  qe as devicePrefix,
  E as effectiveToken,
  De as filters,
  je as fromKeyPress,
  Ve as fromMouse,
  Ie as fromWheel,
  Me as groupLabel,
  ae as hasConflict,
  Te as indexConflicts,
  re as isAssigned,
  I as isFiltering,
  Le as isKnownAction,
  C as keyOf,
  me as keycapLabel,
  P as modeOf,
  Fe as modifierOf,
  ze as rivalsOf,
  Ke as useCapture,
  Pe as useKeyboardLayoutMap,
  y as useT
};
