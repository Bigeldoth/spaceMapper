import { invoke as p } from "@tauri-apps/api/core";
import { useState as m, useEffect as C, createContext as H, useContext as K, useMemo as G, useRef as W } from "react";
import { jsx as n, jsxs as c, Fragment as O } from "react/jsx-runtime";
const g = {
  listDevices: () => p("list_devices"),
  locateActionmaps: () => p("locate_actionmaps"),
  buildInfo: () => p("build_info"),
  /** Confronte le profil au matériel branché. */
  diagnoseDevices: (e) => p("diagnose_devices", { path: e }),
  /** Profils exportés présents dans `Controls\mappings`. */
  listLayouts: (e) => p("list_layouts", { path: e }),
  /** Détaille un profil exporté, sans rien y écrire. */
  inspectLayout: (e) => p("inspect_layout", { path: e }),
  /** Surcharges du joueur fusionnées avec les valeurs par défaut du jeu. */
  listEditableBindings: (e) => p("list_editable_bindings", { path: e }),
  /**
   * Écrit un lot de modifications en une seule fois.
   * Renvoie le chemin du point de restauration créé, ou `null`.
   */
  saveBindings: (e, t, r) => p("save_bindings", {
    path: e,
    edits: t,
    createRestorePoint: r
  }),
  /** Crée un point de restauration ; renvoie le chemin du fichier créé. */
  createBackup: (e) => p("create_backup", { path: e }),
  listBackups: () => p("list_backups"),
  /**
   * Supprime définitivement un point de restauration.
   *
   * Le backend refuse toute cible qui n'est pas une sauvegarde de SpaceMapper :
   * il détermine lui-même le dossier autorisé et ne se fie pas à ce chemin.
   */
  deleteBackup: (e) => p("delete_backup", { backupPath: e }),
  /** Langues réellement présentes dans l'installation du joueur. */
  listGameLanguages: (e) => p("list_game_languages", { path: e }),
  getSettings: () => p("get_settings"),
  setSettings: (e) => p("set_settings", { settings: e }),
  /**
   * Ouvre une session de lecture sur plusieurs périphériques à la fois.
   * Renvoie le numéro de session, à repasser à `stopCapture`.
   */
  startCapture: (e) => p("start_capture", { guids: e }),
  /** Dernier contrôle actionné, ou `null` si rien n'a été pressé. */
  pollCapture: () => p("poll_capture"),
  /** Oublie le dernier relevé sans fermer la session. */
  clearCapture: () => p("clear_capture"),
  /** N'arrête que la session désignée : voir le commentaire côté Rust. */
  stopCapture: (e) => p("stop_capture", { id: e }),
  restoreBackup: (e, t) => p("restore_backup", { path: e, backupPath: t })
}, E = {
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
  moveleft: "Pas à gauche",
  moveright: "Pas à droite",
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
}, B = {
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
function Q(e) {
  return e.label ?? X(e.action);
}
function X(e) {
  const t = E[e];
  if (t) return t;
  const r = e.startsWith("emote_") ? B[e.slice(6)] : void 0;
  return r ? `Émote — ${r}` : e;
}
function $e(e) {
  return e in E || e.startsWith("emote_") && e.slice(6) in B;
}
const J = {
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
function Y(e) {
  return J[e] ?? e;
}
class Ce {
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
function k(e, t) {
  return `${e}/${t}`;
}
function R(e, t) {
  const r = k(e.actionmap, e.action);
  return t.has(r) ? t.get(r) ?? null : e.control && e.control.trim() !== "" ? e.input_raw : null;
}
function ee(e, t) {
  return R(e, t) !== null;
}
function Ae(e, t, r) {
  const a = /* @__PURE__ */ new Map();
  for (const s of e) {
    const i = R(s, t);
    if (i === null) continue;
    const d = a.get(i);
    d ? d.push(s) : a.set(i, [s]);
  }
  const o = /* @__PURE__ */ new Set();
  for (const [, s] of a)
    for (const i of s)
      s.filter(
        (v) => v !== i && r.canCollide(i.context, v.context)
      ).length > 0 && o.add(k(i.actionmap, i.action));
  return { byToken: a, rules: r, flagged: o };
}
function Se(e, t, r) {
  const a = R(e, t);
  if (a === null) return [];
  const o = k(e.actionmap, e.action);
  return (r.byToken.get(a) ?? []).filter(
    (s) => k(s.actionmap, s.action) !== o && r.rules.canCollide(e.context, s.context)
  );
}
function te(e, t, r) {
  return r.flagged.has(k(e.actionmap, e.action));
}
const re = ["x", "y", "z", "rotx", "roty", "rotz", "slider1", "slider2"], ae = ["up", "right", "down", "left"];
function Le(e, t) {
  switch (e) {
    case "buttons":
      return t("control.buttons");
    case "axes":
      return t("control.axes");
    case "hats":
      return t("control.hats");
  }
}
function Oe(e, t) {
  const r = [];
  for (let a = 1; a <= e.buttons; a++)
    r.push({
      value: `button${a}`,
      label: `${t("control.button")} ${a}`,
      group: "buttons"
    });
  for (const a of re.slice(0, e.axes))
    r.push({
      value: a,
      label: `${t("control.axis")} ${a}`,
      group: "axes"
    });
  for (let a = 1; a <= e.povs; a++)
    for (const o of ae)
      r.push({
        value: `hat${a}_${o}`,
        label: `${t("control.hat")} ${a} — ${q(o, t)}`,
        group: "hats"
      });
  return r;
}
function Re(e, t) {
  const r = /^button(\d+)$/.exec(e);
  if (r) return `${t("control.button")} ${r[1]}`;
  const a = /^hat(\d+)_(\w+)$/.exec(e);
  if (a)
    return `${t("control.hat")} ${a[1]} — ${q(a[2], t)}`;
  const o = /^slider(\d+)$/.exec(e);
  return o ? `${t("control.slider")} ${o[1]}` : `${t("control.axis")} ${e}`;
}
function q(e, t) {
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
function Me(e, t) {
  const a = e.filter((s) => s.category === t.category).findIndex(
    (s) => s.instance_guid === t.instance_guid
  );
  return `${t.category === "gamepad" ? "gp" : "js"}${a + 1}`;
}
const F = {
  query: "",
  unassignedOnly: !1,
  conflictsOnly: !1,
  editableOnly: !1
};
function D(e) {
  return e.query.trim() !== "" || e.unassignedOnly || e.conflictsOnly || e.editableOnly;
}
function j(e) {
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
function ne(e, t, r, a, o) {
  const s = M(t.query);
  return e.filter((i) => {
    const d = ee(i, a);
    return r !== "all" && d && j(i) !== r || t.unassignedOnly && d || t.conflictsOnly && !te(i, a, o) || t.editableOnly && i.lock !== null ? !1 : s === "" ? !0 : [
      Q(i),
      i.action,
      i.description ?? "",
      i.input_raw,
      i.control ?? "",
      Y(i.actionmap),
      i.actionmap
    ].some((v) => M(v).includes(s));
  });
}
function M(e) {
  return e.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
const ze = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  NO_FILTERS: F,
  apply: ne,
  isFiltering: D,
  modeOf: j
}, Symbol.toStringTag, { value: "Module" })), se = {
  ShiftLeft: "lshift",
  ShiftRight: "rshift",
  ControlLeft: "lctrl",
  ControlRight: "rctrl",
  AltLeft: "lalt",
  AltRight: "ralt"
}, oe = {
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
}, ie = {
  0: "mouse1",
  1: "mouse3",
  2: "mouse2",
  3: "mouse4",
  4: "mouse5"
};
function Te(e) {
  return se[e] ?? null;
}
function le(e, t) {
  return { token: `kb1_${e ? `${e}+${t}` : t}`, modifier: e, control: t };
}
function Ee(e, t) {
  if (t.length > 1)
    return { ok: !1, error: { kind: "too_many_modifiers" } };
  const r = ce(e);
  return r ? { ok: !0, value: le(t[0] ?? null, r) } : { ok: !1, error: { kind: "unsupported", code: e } };
}
function Be(e, t) {
  if (t.length > 1)
    return { ok: !1, error: { kind: "too_many_modifiers" } };
  const r = ie[e];
  return r ? { ok: !0, value: V(t[0] ?? null, r) } : { ok: !1, error: { kind: "unsupported", code: `mouse${e}` } };
}
function qe(e, t) {
  if (t.length > 1)
    return { ok: !1, error: { kind: "too_many_modifiers" } };
  if (e === 0)
    return { ok: !1, error: { kind: "unsupported", code: "mwheel" } };
  const r = e < 0 ? "mwheel_up" : "mwheel_down";
  return { ok: !0, value: V(t[0] ?? null, r) };
}
function V(e, t) {
  return { token: `mo1_${e ? `${e}+${t}` : t}`, modifier: e, control: t };
}
function ce(e) {
  return /^Key[A-Z]$/.test(e) ? e.slice(3).toLowerCase() : /^Digit[0-9]$/.test(e) ? e.slice(5) : /^F([1-9]|1[0-2])$/.test(e) ? e.toLowerCase() : /^Numpad[0-9]$/.test(e) ? `np_${e.slice(6)}` : oe[e] ?? null;
}
function ue(e) {
  return /^[a-z]$/.test(e) ? `Key${e.toUpperCase()}` : /^[0-9]$/.test(e) ? `Digit${e}` : null;
}
function Fe() {
  const [e, t] = m(null);
  return C(() => {
    let r = !1;
    const a = navigator.keyboard;
    if (a?.getLayoutMap)
      return a.getLayoutMap().then((o) => {
        r || t(o);
      }).catch(() => {
      }), () => {
        r = !0;
      };
  }, []), e;
}
const de = {
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
function I(e, t) {
  const r = de[e];
  return r ? t(r) : e.startsWith("np_") ? `${t("key.numpad")} ${e.slice(3)}` : e.toUpperCase();
}
function pe(e, t, r) {
  if (t && /^[a-z0-9]$/.test(e)) {
    const a = ue(e), o = a ? t.get(a) : void 0;
    if (o && /^[a-z0-9]$/i.test(o)) return o.toUpperCase();
  }
  return I(e, r);
}
function De(e, t, r) {
  const a = pe(e.control, r ?? null, t);
  return e.modifier ? `${I(e.modifier, t)} + ${a}` : a;
}
function je(e, t) {
  switch (e.kind) {
    case "too_many_modifiers":
      return t("capture.tooManyModifiers");
    case "unsupported":
      return `${t("capture.unsupported")} (${e.code})`;
  }
}
const P = H((e) => e);
function Ve({
  translate: e,
  children: t
}) {
  const r = G(() => e, [e]);
  return /* @__PURE__ */ n(P.Provider, { value: r, children: t });
}
function y() {
  return K(P);
}
function Ie(e, t) {
  const [r, a] = m(null), [o, s] = m(!1), [i, d] = m(null), v = e.map((u) => u.instance_guid).join("|");
  return C(() => {
    if (!t || v === "") {
      s(!1);
      return;
    }
    let u = !1;
    d(null), s(!1);
    const h = g.startCapture(v.split("|"));
    h.then(
      () => !u && s(!0),
      (f) => !u && d(String(f))
    );
    const b = window.setInterval(async () => {
      try {
        const f = await g.pollCapture();
        !u && f && a(f);
      } catch (f) {
        u || d(String(f));
      }
    }, 60);
    return () => {
      u = !0, window.clearInterval(b), h.then((f) => g.stopCapture(f)).catch(() => {
      });
    };
  }, [v, t]), {
    last: r,
    listening: o,
    error: i,
    // L'oubli doit aussi porter côté Rust : le thread garde son relevé, et le
    // sondage suivant le restaurerait aussitôt.
    reset: () => {
      a(null), g.clearCapture().catch(() => {
      });
    }
  };
}
function Pe(e, t, r) {
  if (!e) return null;
  const a = t.find((o) => o.instance_guid === e.guid);
  return a ? `${r(a)}_${e.control}` : null;
}
function Ze({
  profilePath: e,
  mode: t,
  onModeChange: r,
  listening: a,
  deviceCount: o,
  captureError: s,
  probe: i,
  onClearProbe: d,
  onRestored: v
}) {
  const u = y(), [h, b] = m([]), [f, N] = m(!1), [$, w] = m(!1), [l, _] = m(null);
  async function A() {
    try {
      b(await g.listBackups());
    } catch {
    }
  }
  C(() => {
    A();
  }, []);
  async function Z() {
    w(!0);
    try {
      await g.createBackup(e), _(u("backup.created")), await A();
    } catch (x) {
      _(String(x));
    } finally {
      w(!1);
    }
  }
  const U = [
    { id: "all", label: "filter.mode.all" },
    { id: "desk", label: "filter.mode.desk" },
    { id: "gamepad", label: "filter.mode.gamepad" },
    { id: "joystick", label: "filter.mode.joystick" }
  ];
  return /* @__PURE__ */ c("div", { className: "space-y-2", children: [
    /* @__PURE__ */ c("div", { className: "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2", children: [
      /* @__PURE__ */ c("div", { className: "-mx-1 flex max-w-full items-center gap-1 overflow-x-auto overflow-y-hidden px-1", children: [
        /* @__PURE__ */ n("span", { className: "mr-1 shrink-0 text-xs font-medium text-[var(--text-tertiary)]", children: u("filter.mode") }),
        U.map((x) => /* @__PURE__ */ n(
          "button",
          {
            onClick: () => r(x.id),
            className: "shrink-0 whitespace-nowrap rounded-[var(--radius-control)] px-2.5 py-1 text-xs font-medium transition-colors " + (t === x.id ? "bg-accent text-white" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"),
            children: u(x.label)
          },
          x.id
        ))
      ] }),
      /* @__PURE__ */ c("div", { className: "flex flex-wrap items-center gap-3 sm:ml-auto", children: [
        /* @__PURE__ */ n(
          ve,
          {
            listening: a,
            count: o,
            error: s,
            probe: i,
            onClear: d
          }
        ),
        /* @__PURE__ */ c("div", { className: "relative", children: [
          /* @__PURE__ */ c("div", { className: "flex items-center rounded-[var(--radius-control)] border border-[var(--border-default)]", children: [
            /* @__PURE__ */ n(
              "button",
              {
                onClick: () => {
                  Z();
                },
                disabled: $,
                className: "rounded-l-md px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:text-[var(--text-disabled)]",
                children: u("backup.create")
              }
            ),
            /* @__PURE__ */ c(
              "button",
              {
                onClick: () => N((x) => !x),
                className: "border-l border-[var(--border-default)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]",
                title: u("backup.title"),
                children: [
                  h.length,
                  " ▾"
                ]
              }
            )
          ] }),
          f && /* @__PURE__ */ n(
            fe,
            {
              profilePath: e,
              backups: h,
              onClose: () => N(!1),
              onChanged: async () => {
                await A(), v();
              }
            }
          )
        ] }),
        /* @__PURE__ */ n(me, {})
      ] })
    ] }),
    l && /* @__PURE__ */ n("p", { className: "rounded-[var(--radius-control)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs text-[var(--text-accent)]", children: l })
  ] });
}
function ve({
  listening: e,
  count: t,
  error: r,
  probe: a,
  onClear: o
}) {
  const s = y();
  return r ? /* @__PURE__ */ n("span", { className: "text-xs text-[var(--danger-text)]", title: r, children: s("probe.stopped") }) : a ? /* @__PURE__ */ c("span", { className: "flex items-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--accent-soft)] px-2 py-1 text-xs text-[var(--text-accent)]", children: [
    /* @__PURE__ */ n("span", { className: "font-mono font-semibold", children: a.device }),
    /* @__PURE__ */ n("span", { children: a.control }),
    /* @__PURE__ */ n("span", { className: "text-[var(--text-accent)]", children: "·" }),
    /* @__PURE__ */ n("span", { children: a.matches === 0 ? s("probe.noMatch") : `${a.matches} ${s(
      a.matches > 1 ? "probe.matchMany" : "probe.matchOne"
    )}` }),
    /* @__PURE__ */ n(
      "button",
      {
        onClick: o,
        className: "ml-1 text-[var(--text-accent)] hover:text-[var(--accent-hover)]",
        children: s("probe.clear")
      }
    )
  ] }) : /* @__PURE__ */ c(
    "span",
    {
      className: "flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]",
      title: s("probe.idle"),
      children: [
        /* @__PURE__ */ n(
          "span",
          {
            className: "inline-block h-1.5 w-1.5 rounded-full " + (e ? "bg-[var(--accent-soft)]0" : "bg-[var(--border-default)]")
          }
        ),
        t,
        " ",
        s(t > 1 ? "probe.deviceMany" : "probe.deviceOne")
      ]
    }
  );
}
function me() {
  const e = y(), [t, r] = m(!1);
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
    t && /* @__PURE__ */ c(O, { children: [
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
function fe({
  profilePath: e,
  backups: t,
  onClose: r,
  onChanged: a
}) {
  const o = y(), [s, i] = m(null), d = W(null);
  async function v() {
    if (!s) return;
    const { backup: u, action: h } = s;
    i(null);
    try {
      h === "restore" ? await g.restoreBackup(e, u.path) : await g.deleteBackup(u.path), a();
    } catch {
    }
    r();
  }
  return /* @__PURE__ */ c(O, { children: [
    /* @__PURE__ */ n("div", { className: "fixed inset-0 z-10", onClick: r }),
    /* @__PURE__ */ c(
      "div",
      {
        ref: d,
        className: "absolute right-0 z-20 mt-1 w-72 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] shadow-[var(--shadow-2)]",
        children: [
          /* @__PURE__ */ n("p", { className: "border-b border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-tertiary)]", children: o("backup.hint") }),
          t.length === 0 ? /* @__PURE__ */ n("p", { className: "px-3 py-4 text-center text-xs text-[var(--text-tertiary)]", children: o("backup.empty") }) : /* @__PURE__ */ n("ul", { className: "max-h-64 divide-y divide-[var(--border-subtle)] overflow-y-auto", children: t.map((u) => /* @__PURE__ */ c("li", { className: "px-3 py-2", children: [
            /* @__PURE__ */ n("p", { className: "text-xs text-[var(--text-primary)]", children: z(u.timestamp) }),
            /* @__PURE__ */ c("div", { className: "mt-1 flex gap-2", children: [
              /* @__PURE__ */ n(
                "button",
                {
                  onClick: () => i({ backup: u, action: "restore" }),
                  className: "text-xs font-medium text-[var(--text-accent)] hover:text-[var(--accent-hover)]",
                  children: o("backup.restore")
                }
              ),
              /* @__PURE__ */ n(
                "button",
                {
                  onClick: () => i({ backup: u, action: "delete" }),
                  className: "text-xs text-[var(--text-tertiary)] hover:text-[var(--danger-text)]",
                  children: o("backup.delete")
                }
              )
            ] })
          ] }, u.path)) })
        ]
      }
    ),
    s && /* @__PURE__ */ n(
      "div",
      {
        className: "fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[var(--scrim)] p-4 sm:p-8",
        onClick: () => i(null),
        children: /* @__PURE__ */ c(
          "div",
          {
            className: "w-full max-w-md rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-5 shadow-[var(--shadow-2)]",
            onClick: (u) => u.stopPropagation(),
            children: [
              /* @__PURE__ */ n("h3", { className: "text-sm font-semibold text-[var(--text-primary)]", children: o(
                s.action === "delete" ? "backup.confirmDeleteTitle" : "backup.confirmTitle"
              ) }),
              /* @__PURE__ */ n("p", { className: "mt-2 text-sm text-[var(--text-secondary)]", children: z(s.backup.timestamp) }),
              /* @__PURE__ */ n(
                "p",
                {
                  className: "mt-2 text-sm " + (s.action === "delete" ? "text-[var(--danger-text)]" : "text-[var(--text-tertiary)]"),
                  children: o(
                    s.action === "delete" ? "backup.confirmDeleteBody" : "backup.confirmKept"
                  )
                }
              ),
              /* @__PURE__ */ c("div", { className: "mt-4 flex justify-end gap-2", children: [
                /* @__PURE__ */ n(
                  "button",
                  {
                    onClick: () => i(null),
                    className: "rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-2)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)]",
                    children: o("save.cancel")
                  }
                ),
                /* @__PURE__ */ n(
                  "button",
                  {
                    onClick: () => {
                      v();
                    },
                    className: "rounded-[var(--radius-control)] px-3 py-1.5 text-sm font-medium text-white " + (s.action === "delete" ? "bg-[var(--danger)] hover:bg-[var(--danger)]" : "bg-accent hover:bg-[var(--accent-hover)]"),
                    children: o(
                      s.action === "delete" ? "backup.delete" : "backup.restore"
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
function z(e) {
  const t = Number(e);
  return Number.isFinite(t) ? new Date(t).toLocaleString(void 0, {
    dateStyle: "medium",
    timeStyle: "short"
  }) : e;
}
const _e = {
  sm: "h-[var(--h-control-sm)] px-[var(--sp-5)] text-[length:var(--fs-body-sm)]",
  md: "h-[var(--h-control)] px-[var(--sp-6)] text-[length:var(--fs-body)]",
  lg: "h-[var(--h-control-lg)] px-[var(--sp-7)] text-[length:var(--fs-body)]"
}, ge = {
  primary: "border border-transparent bg-accent text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)] hover:shadow-[var(--glow-soft)] active:bg-[var(--accent-press)] active:shadow-none",
  secondary: "border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]",
  ghost: "border border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
};
function T({
  variant: e = "primary",
  size: t = "md",
  className: r = "",
  ...a
}) {
  return /* @__PURE__ */ n(
    "button",
    {
      className: `inline-flex items-center justify-center gap-[var(--sp-3)] rounded-[var(--radius-control)] font-medium leading-none transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] focus-visible:shadow-[var(--ring-focus)] active:scale-[var(--press-scale)] disabled:pointer-events-none disabled:opacity-[0.42] ${_e[t]} ${ge[e]} ${r}`,
      ...a
    }
  );
}
const he = "cursor-pointer transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:-translate-y-px hover:border-[var(--border-accent)]";
function be() {
  const e = "pointer-events-none absolute h-[10px] w-[10px] border-[var(--border-hud)]";
  return /* @__PURE__ */ c(O, { children: [
    /* @__PURE__ */ n("span", { "aria-hidden": !0, className: `${e} left-0 top-0 border-l-2 border-t-2` }),
    /* @__PURE__ */ n("span", { "aria-hidden": !0, className: `${e} right-0 top-0 border-r-2 border-t-2` }),
    /* @__PURE__ */ n("span", { "aria-hidden": !0, className: `${e} bottom-0 left-0 border-b-2 border-l-2` }),
    /* @__PURE__ */ n("span", { "aria-hidden": !0, className: `${e} bottom-0 right-0 border-b-2 border-r-2` })
  ] });
}
function xe({
  variant: e = "standard",
  interactive: t = !1,
  className: r = "",
  children: a,
  ...o
}) {
  const s = t ? he : "";
  return e === "hud" ? /* @__PURE__ */ c(
    "div",
    {
      className: `relative rounded-[var(--radius-xs)] border border-[var(--border-hud)] bg-[var(--surface-1)] p-[var(--pad-card)] ${s} ${r}`,
      ...o,
      children: [
        /* @__PURE__ */ n(be, {}),
        a
      ]
    }
  ) : /* @__PURE__ */ n(
    "div",
    {
      className: `rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-[var(--pad-card)] shadow-[var(--shadow-1)] ${s} ${r}`,
      ...o,
      children: a
    }
  );
}
function ye({ selected: e = !1, className: t = "", ...r }) {
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
function Ue({
  filters: e,
  onChange: t,
  shown: r,
  total: a,
  conflictCount: o,
  unassignedCount: s
}) {
  const i = y();
  return /* @__PURE__ */ c("div", { className: "flex flex-wrap items-center gap-x-4 gap-y-2", children: [
    /* @__PURE__ */ n(
      "input",
      {
        type: "search",
        value: e.query,
        onChange: (d) => t({ ...e, query: d.target.value }),
        placeholder: i("filter.placeholder"),
        className: "min-w-56 flex-1 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-2)] px-[var(--sp-6)] py-[var(--sp-4)] text-[length:var(--fs-body-sm)] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:border-[var(--border-accent)] focus-visible:shadow-[var(--ring-focus)] focus:outline-none"
      }
    ),
    /* @__PURE__ */ n(
      S,
      {
        active: e.unassignedOnly,
        count: s,
        onClick: () => t({ ...e, unassignedOnly: !e.unassignedOnly }),
        children: i("filter.unassigned")
      }
    ),
    /* @__PURE__ */ n(
      S,
      {
        active: e.conflictsOnly,
        count: o,
        warn: !0,
        onClick: () => t({ ...e, conflictsOnly: !e.conflictsOnly }),
        children: i("filter.conflicts")
      }
    ),
    /* @__PURE__ */ n(
      S,
      {
        active: e.editableOnly,
        onClick: () => t({ ...e, editableOnly: !e.editableOnly }),
        children: i("filter.editableOnly")
      }
    ),
    /* @__PURE__ */ n("span", { className: "ml-auto whitespace-nowrap rounded-[var(--radius-pill)] border border-[var(--border-subtle)] px-[var(--sp-5)] py-[var(--sp-2)] text-[length:var(--fs-caption)] text-[var(--text-tertiary)]", children: r === a ? `${a}` : `${r} / ${a}` }),
    D(e) && /* @__PURE__ */ n(
      "button",
      {
        onClick: () => t(F),
        className: "whitespace-nowrap text-[length:var(--fs-caption)] font-medium text-[var(--text-accent)] hover:text-[var(--accent-hover)]",
        children: i("filter.showAll")
      }
    )
  ] });
}
function S({
  active: e,
  count: t,
  warn: r,
  onClick: a,
  children: o
}) {
  const s = t === 0;
  return /* @__PURE__ */ c(
    ye,
    {
      selected: e,
      onClick: a,
      disabled: s && !e,
      className: `${s && !e ? "opacity-[0.42]" : ""} ${r && e ? "!border-[var(--danger)] !bg-[var(--danger-soft)] !text-[var(--danger-text)]" : ""}`,
      children: [
        o,
        t !== void 0 && // `border-current` plutôt qu'une couleur fixe : le compteur doit se
        // détacher du libellé quel que soit l'état du Tag (actif, alerte,
        // survolé) sans dupliquer sa palette de couleurs ici.
        /* @__PURE__ */ n("span", { className: "tabular-nums rounded-full border border-current/30 px-[var(--sp-3)] text-[length:var(--fs-caption)] opacity-80", children: t })
      ]
    }
  );
}
function He({
  profilePath: e,
  profiles: t,
  onSelectProfile: r,
  onBrowse: a,
  onChanged: o
}) {
  const s = y(), [i, d] = m(null), [v, u] = m([]), [h, b] = m(null), [f, N] = m(null);
  C(() => {
    let l = !1;
    return (async () => {
      try {
        const _ = await g.getSettings();
        l || d(_);
      } catch (_) {
        l || b(String(_));
      }
      if (e)
        try {
          const _ = await g.listGameLanguages(e);
          l || u(_);
        } catch (_) {
          l || b(String(_));
        }
    })(), () => {
      l = !0;
    };
  }, [e]);
  async function $(l) {
    d(l);
    try {
      await g.setSettings(l), N(s("settings.saved")), b(null), o();
    } catch (_) {
      b(String(_));
    }
  }
  if (!i)
    return /* @__PURE__ */ n("p", { className: "text-[length:var(--fs-body-sm)] text-[var(--text-tertiary)]", children: s("settings.loading") });
  const w = "min-w-0 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-2)] px-[var(--sp-6)] py-[var(--sp-4)] text-[length:var(--fs-body-sm)] text-[var(--text-primary)] focus:border-[var(--border-accent)] focus-visible:shadow-[var(--ring-focus)] focus:outline-none";
  return /* @__PURE__ */ c("div", { className: "space-y-[var(--sp-6)]", children: [
    /* @__PURE__ */ c(L, { title: s("profile.title"), hint: s("profile.hint"), children: [
      /* @__PURE__ */ c("div", { className: "flex flex-wrap items-center gap-[var(--sp-4)]", children: [
        t.length > 0 ? /* @__PURE__ */ n(
          "select",
          {
            className: `flex-1 sm:flex-none ${w}`,
            value: e ?? "",
            onChange: (l) => r(l.target.value),
            children: t.map((l) => /* @__PURE__ */ n("option", { value: l.path, children: l.channel }, l.path))
          }
        ) : /* @__PURE__ */ n("p", { className: "text-[length:var(--fs-body-sm)] text-[var(--text-tertiary)]", children: s("profile.none") }),
        /* @__PURE__ */ n(T, { variant: "secondary", size: "sm", onClick: a, className: "shrink-0", children: s("profile.browse") })
      ] }),
      e && /* @__PURE__ */ n("p", { className: "technical mt-[var(--sp-4)] break-all text-[var(--text-disabled)]", children: e })
    ] }),
    /* @__PURE__ */ n(
      L,
      {
        title: s("settings.gameLanguage"),
        hint: s("settings.gameLanguageHint"),
        children: v.length === 0 ? /* @__PURE__ */ n("p", { className: "text-[length:var(--fs-body-sm)] text-[var(--text-tertiary)]", children: s("settings.noLanguages") }) : /* @__PURE__ */ n(
          "select",
          {
            className: `w-full max-w-sm ${w}`,
            value: i.game_language,
            onChange: (l) => {
              $({ ...i, game_language: l.target.value });
            },
            children: v.map((l) => /* @__PURE__ */ n("option", { value: l.id, children: l.label }, l.id))
          }
        )
      }
    ),
    /* @__PURE__ */ c(
      L,
      {
        title: s("settings.uiLanguage"),
        hint: s("settings.uiLanguageHint"),
        children: [
          /* @__PURE__ */ n("div", { className: "flex gap-[var(--sp-4)]", children: [
            { id: "fr", label: "Français" },
            { id: "en", label: "English" }
          ].map((l) => /* @__PURE__ */ n(
            T,
            {
              size: "sm",
              variant: i.ui_language === l.id ? "primary" : "secondary",
              onClick: () => {
                $({ ...i, ui_language: l.id });
              },
              children: l.label
            },
            l.id
          )) }),
          /* @__PURE__ */ n("p", { className: "mt-[var(--sp-4)] text-[length:var(--fs-caption)] text-[var(--text-tertiary)]", children: s("settings.installHint") })
        ]
      }
    ),
    f && /* @__PURE__ */ n("p", { className: "text-[length:var(--fs-body-sm)] text-[var(--success-text)]", children: f }),
    h && /* @__PURE__ */ n("p", { className: "text-[length:var(--fs-body-sm)] text-[var(--danger-text)]", children: h })
  ] });
}
function L({
  title: e,
  hint: t,
  children: r
}) {
  return /* @__PURE__ */ c(xe, { children: [
    /* @__PURE__ */ n("h3", { className: "text-[length:var(--fs-body)] font-semibold text-[var(--text-primary)]", children: e }),
    /* @__PURE__ */ n("p", { className: "mb-[var(--sp-4)] mt-[var(--sp-1)] text-[length:var(--fs-caption)] text-[var(--text-tertiary)]", children: t }),
    r
  ] });
}
export {
  re as AXES,
  Ce as ContextRules,
  Ze as EditorToolbar,
  Ue as FilterBar,
  F as NO_FILTERS,
  He as SettingsPanel,
  Ve as TranslationProvider,
  X as actionLabel,
  g as api,
  ne as apply,
  Q as bindingLabel,
  le as build,
  je as captureErrorMessage,
  Pe as capturedToken,
  Y as categoryLabel,
  Re as controlLabel,
  Oe as controlsFor,
  De as describe,
  Me as devicePrefix,
  R as effectiveToken,
  ze as filters,
  Ee as fromKeyPress,
  Be as fromMouse,
  qe as fromWheel,
  Le as groupLabel,
  te as hasConflict,
  Ae as indexConflicts,
  ee as isAssigned,
  D as isFiltering,
  $e as isKnownAction,
  k as keyOf,
  pe as keycapLabel,
  j as modeOf,
  Te as modifierOf,
  Se as rivalsOf,
  Ie as useCapture,
  Fe as useKeyboardLayoutMap,
  y as useT
};
