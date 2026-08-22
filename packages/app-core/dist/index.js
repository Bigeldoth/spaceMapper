import { invoke as v } from "@tauri-apps/api/core";
import { jsx as a, jsxs as c, Fragment as L } from "react/jsx-runtime";
import { createContext as U, useContext as G, useMemo as K, useState as f, useEffect as O, useRef as W } from "react";
const g = {
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
}, B = {
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
}, q = {
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
  const t = B[e];
  if (t) return t;
  const r = e.startsWith("emote_") ? q[e.slice(6)] : void 0;
  return r ? `Émote — ${r}` : e;
}
function ke(e) {
  return e in B || e.startsWith("emote_") && e.slice(6) in q;
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
class Ne {
  pairs;
  constructor(t) {
    this.pairs = new Set(
      (t ?? []).flatMap(([r, n]) => [`${r}|${n}`, `${n}|${r}`])
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
function $e(e, t, r) {
  const n = /* @__PURE__ */ new Map();
  for (const s of e) {
    const o = R(s, t);
    if (o === null) continue;
    const d = n.get(o);
    d ? d.push(s) : n.set(o, [s]);
  }
  const i = /* @__PURE__ */ new Set();
  for (const [, s] of n)
    for (const o of s)
      s.filter(
        (p) => p !== o && r.canCollide(o.context, p.context)
      ).length > 0 && i.add(k(o.actionmap, o.action));
  return { byToken: n, rules: r, flagged: i };
}
function Ce(e, t, r) {
  const n = R(e, t);
  if (n === null) return [];
  const i = k(e.actionmap, e.action);
  return (r.byToken.get(n) ?? []).filter(
    (s) => k(s.actionmap, s.action) !== i && r.rules.canCollide(e.context, s.context)
  );
}
function te(e, t, r) {
  return r.flagged.has(k(e.actionmap, e.action));
}
const re = ["x", "y", "z", "rotx", "roty", "rotz", "slider1", "slider2"], ae = ["up", "right", "down", "left"];
function Ae(e, t) {
  switch (e) {
    case "buttons":
      return t("control.buttons");
    case "axes":
      return t("control.axes");
    case "hats":
      return t("control.hats");
  }
}
function Se(e, t) {
  const r = [];
  for (let n = 1; n <= e.buttons; n++)
    r.push({
      value: `button${n}`,
      label: `${t("control.button")} ${n}`,
      group: "buttons"
    });
  for (const n of re.slice(0, e.axes))
    r.push({
      value: n,
      label: `${t("control.axis")} ${n}`,
      group: "axes"
    });
  for (let n = 1; n <= e.povs; n++)
    for (const i of ae)
      r.push({
        value: `hat${n}_${i}`,
        label: `${t("control.hat")} ${n} — ${F(i, t)}`,
        group: "hats"
      });
  return r;
}
function Le(e, t) {
  const r = /^button(\d+)$/.exec(e);
  if (r) return `${t("control.button")} ${r[1]}`;
  const n = /^hat(\d+)_(\w+)$/.exec(e);
  if (n)
    return `${t("control.hat")} ${n[1]} — ${F(n[2], t)}`;
  const i = /^slider(\d+)$/.exec(e);
  return i ? `${t("control.slider")} ${i[1]}` : `${t("control.axis")} ${e}`;
}
function F(e, t) {
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
function Oe(e, t) {
  const n = e.filter((s) => s.category === t.category).findIndex(
    (s) => s.instance_guid === t.instance_guid
  );
  return `${t.category === "gamepad" ? "gp" : "js"}${n + 1}`;
}
const j = {
  query: "",
  unassignedOnly: !1,
  conflictsOnly: !1,
  editableOnly: !1
};
function D(e) {
  return e.query.trim() !== "" || e.unassignedOnly || e.conflictsOnly || e.editableOnly;
}
function V(e) {
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
function ne(e, t, r, n, i) {
  const s = M(t.query);
  return e.filter((o) => {
    const d = ee(o, n);
    return r !== "all" && d && V(o) !== r || t.unassignedOnly && d || t.conflictsOnly && !te(o, n, i) || t.editableOnly && o.lock !== null ? !1 : s === "" ? !0 : [
      Q(o),
      o.action,
      o.description ?? "",
      o.input_raw,
      o.control ?? "",
      Y(o.actionmap),
      o.actionmap
    ].some((p) => M(p).includes(s));
  });
}
function M(e) {
  return e.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
const Re = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  NO_FILTERS: j,
  apply: ne,
  isFiltering: D,
  modeOf: V
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
function Me(e) {
  return se[e] ?? null;
}
function le(e, t) {
  return { token: `kb1_${e ? `${e}+${t}` : t}`, modifier: e, control: t };
}
function Te(e, t) {
  if (t.length > 1)
    return { ok: !1, error: { kind: "too_many_modifiers" } };
  const r = ce(e);
  return r ? { ok: !0, value: le(t[0] ?? null, r) } : { ok: !1, error: { kind: "unsupported", code: e } };
}
function Ee(e, t) {
  if (t.length > 1)
    return { ok: !1, error: { kind: "too_many_modifiers" } };
  const r = ie[e];
  return r ? { ok: !0, value: I(t[0] ?? null, r) } : { ok: !1, error: { kind: "unsupported", code: `mouse${e}` } };
}
function ze(e, t) {
  if (t.length > 1)
    return { ok: !1, error: { kind: "too_many_modifiers" } };
  if (e === 0)
    return { ok: !1, error: { kind: "unsupported", code: "mwheel" } };
  const r = e < 0 ? "mwheel_up" : "mwheel_down";
  return { ok: !0, value: I(t[0] ?? null, r) };
}
function I(e, t) {
  return { token: `mo1_${e ? `${e}+${t}` : t}`, modifier: e, control: t };
}
function ce(e) {
  return /^Key[A-Z]$/.test(e) ? e.slice(3).toLowerCase() : /^Digit[0-9]$/.test(e) ? e.slice(5) : /^F([1-9]|1[0-2])$/.test(e) ? e.toLowerCase() : /^Numpad[0-9]$/.test(e) ? `np_${e.slice(6)}` : oe[e] ?? null;
}
const ue = {
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
function T(e, t) {
  const r = ue[e];
  return r ? t(r) : e.startsWith("np_") ? `${t("key.numpad")} ${e.slice(3)}` : e.toUpperCase();
}
function Be(e, t) {
  const r = T(e.control, t);
  return e.modifier ? `${T(e.modifier, t)} + ${r}` : r;
}
function qe(e, t) {
  switch (e.kind) {
    case "too_many_modifiers":
      return t("capture.tooManyModifiers");
    case "unsupported":
      return `${t("capture.unsupported")} (${e.code})`;
  }
}
const P = U((e) => e);
function Fe({
  translate: e,
  children: t
}) {
  const r = K(() => e, [e]);
  return /* @__PURE__ */ a(P.Provider, { value: r, children: t });
}
function y() {
  return G(P);
}
function je(e, t) {
  const [r, n] = f(null), [i, s] = f(!1), [o, d] = f(null), p = e.map((u) => u.instance_guid).join("|");
  return O(() => {
    if (!t || p === "") {
      s(!1);
      return;
    }
    let u = !1;
    d(null), s(!1);
    const h = g.startCapture(p.split("|"));
    h.then(
      () => !u && s(!0),
      (m) => !u && d(String(m))
    );
    const b = window.setInterval(async () => {
      try {
        const m = await g.pollCapture();
        !u && m && n(m);
      } catch (m) {
        u || d(String(m));
      }
    }, 60);
    return () => {
      u = !0, window.clearInterval(b), h.then((m) => g.stopCapture(m)).catch(() => {
      });
    };
  }, [p, t]), {
    last: r,
    listening: i,
    error: o,
    // L'oubli doit aussi porter côté Rust : le thread garde son relevé, et le
    // sondage suivant le restaurerait aussitôt.
    reset: () => {
      n(null), g.clearCapture().catch(() => {
      });
    }
  };
}
function De(e, t, r) {
  if (!e) return null;
  const n = t.find((i) => i.instance_guid === e.guid);
  return n ? `${r(n)}_${e.control}` : null;
}
function Ve({
  profilePath: e,
  mode: t,
  onModeChange: r,
  listening: n,
  deviceCount: i,
  captureError: s,
  probe: o,
  onClearProbe: d,
  onRestored: p
}) {
  const u = y(), [h, b] = f([]), [m, N] = f(!1), [$, w] = f(!1), [l, _] = f(null);
  async function C() {
    try {
      b(await g.listBackups());
    } catch {
    }
  }
  O(() => {
    C();
  }, []);
  async function Z() {
    w(!0);
    try {
      await g.createBackup(e), _(u("backup.created")), await C();
    } catch (x) {
      _(String(x));
    } finally {
      w(!1);
    }
  }
  const H = [
    { id: "all", label: "filter.mode.all" },
    { id: "desk", label: "filter.mode.desk" },
    { id: "gamepad", label: "filter.mode.gamepad" },
    { id: "joystick", label: "filter.mode.joystick" }
  ];
  return /* @__PURE__ */ c("div", { className: "space-y-2", children: [
    /* @__PURE__ */ c("div", { className: "flex flex-wrap items-center gap-x-4 gap-y-2 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2", children: [
      /* @__PURE__ */ c("div", { className: "-mx-1 flex max-w-full items-center gap-1 overflow-x-auto overflow-y-hidden px-1", children: [
        /* @__PURE__ */ a("span", { className: "mr-1 shrink-0 text-xs font-medium text-[var(--text-tertiary)]", children: u("filter.mode") }),
        H.map((x) => /* @__PURE__ */ a(
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
        /* @__PURE__ */ a(
          de,
          {
            listening: n,
            count: i,
            error: s,
            probe: o,
            onClear: d
          }
        ),
        /* @__PURE__ */ c("div", { className: "relative", children: [
          /* @__PURE__ */ c("div", { className: "flex items-center rounded-[var(--radius-control)] border border-[var(--border-default)]", children: [
            /* @__PURE__ */ a(
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
          m && /* @__PURE__ */ a(
            pe,
            {
              profilePath: e,
              backups: h,
              onClose: () => N(!1),
              onChanged: async () => {
                await C(), p();
              }
            }
          )
        ] }),
        /* @__PURE__ */ a(ve, {})
      ] })
    ] }),
    l && /* @__PURE__ */ a("p", { className: "rounded-[var(--radius-control)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs text-[var(--text-accent)]", children: l })
  ] });
}
function de({
  listening: e,
  count: t,
  error: r,
  probe: n,
  onClear: i
}) {
  const s = y();
  return r ? /* @__PURE__ */ a("span", { className: "text-xs text-[var(--danger-text)]", title: r, children: s("probe.stopped") }) : n ? /* @__PURE__ */ c("span", { className: "flex items-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--accent-soft)] px-2 py-1 text-xs text-[var(--text-accent)]", children: [
    /* @__PURE__ */ a("span", { className: "font-mono font-semibold", children: n.device }),
    /* @__PURE__ */ a("span", { children: n.control }),
    /* @__PURE__ */ a("span", { className: "text-[var(--text-accent)]", children: "·" }),
    /* @__PURE__ */ a("span", { children: n.matches === 0 ? s("probe.noMatch") : `${n.matches} ${s(
      n.matches > 1 ? "probe.matchMany" : "probe.matchOne"
    )}` }),
    /* @__PURE__ */ a(
      "button",
      {
        onClick: i,
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
        /* @__PURE__ */ a(
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
function ve() {
  const e = y(), [t, r] = f(!1);
  return /* @__PURE__ */ c("div", { className: "relative", children: [
    /* @__PURE__ */ a(
      "button",
      {
        onClick: () => r((n) => !n),
        className: "flex h-5 w-5 items-center justify-center rounded-full border border-[var(--border-default)] text-xs text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]",
        title: e("scope.title"),
        children: "?"
      }
    ),
    t && /* @__PURE__ */ c(L, { children: [
      /* @__PURE__ */ a("div", { className: "fixed inset-0 z-10", onClick: () => r(!1) }),
      /* @__PURE__ */ c("div", { className: "absolute right-0 z-20 mt-2 w-80 rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 shadow-[var(--shadow-2)]", children: [
        /* @__PURE__ */ a("h4", { className: "text-xs font-semibold text-[var(--text-primary)]", children: e("scope.title") }),
        /* @__PURE__ */ a("p", { className: "mt-1 text-xs text-[var(--text-secondary)]", children: e("scope.editable") }),
        /* @__PURE__ */ a("p", { className: "mt-2 text-xs text-[var(--text-secondary)]", children: e("scope.defaults") }),
        /* @__PURE__ */ a("p", { className: "mt-2 text-xs text-[var(--danger-text)]", children: e("scope.closeGame") })
      ] })
    ] })
  ] });
}
function pe({
  profilePath: e,
  backups: t,
  onClose: r,
  onChanged: n
}) {
  const i = y(), [s, o] = f(null), d = W(null);
  async function p() {
    if (!s) return;
    const { backup: u, action: h } = s;
    o(null);
    try {
      h === "restore" ? await g.restoreBackup(e, u.path) : await g.deleteBackup(u.path), n();
    } catch {
    }
    r();
  }
  return /* @__PURE__ */ c(L, { children: [
    /* @__PURE__ */ a("div", { className: "fixed inset-0 z-10", onClick: r }),
    /* @__PURE__ */ c(
      "div",
      {
        ref: d,
        className: "absolute right-0 z-20 mt-1 w-72 overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] shadow-[var(--shadow-2)]",
        children: [
          /* @__PURE__ */ a("p", { className: "border-b border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-tertiary)]", children: i("backup.hint") }),
          t.length === 0 ? /* @__PURE__ */ a("p", { className: "px-3 py-4 text-center text-xs text-[var(--text-tertiary)]", children: i("backup.empty") }) : /* @__PURE__ */ a("ul", { className: "max-h-64 divide-y divide-[var(--border-subtle)] overflow-y-auto", children: t.map((u) => /* @__PURE__ */ c("li", { className: "px-3 py-2", children: [
            /* @__PURE__ */ a("p", { className: "text-xs text-[var(--text-primary)]", children: E(u.timestamp) }),
            /* @__PURE__ */ c("div", { className: "mt-1 flex gap-2", children: [
              /* @__PURE__ */ a(
                "button",
                {
                  onClick: () => o({ backup: u, action: "restore" }),
                  className: "text-xs font-medium text-[var(--text-accent)] hover:text-[var(--accent-hover)]",
                  children: i("backup.restore")
                }
              ),
              /* @__PURE__ */ a(
                "button",
                {
                  onClick: () => o({ backup: u, action: "delete" }),
                  className: "text-xs text-[var(--text-tertiary)] hover:text-[var(--danger-text)]",
                  children: i("backup.delete")
                }
              )
            ] })
          ] }, u.path)) })
        ]
      }
    ),
    s && /* @__PURE__ */ a(
      "div",
      {
        className: "fixed inset-0 z-30 flex items-center justify-center overflow-y-auto bg-[var(--scrim)] p-4 sm:p-8",
        onClick: () => o(null),
        children: /* @__PURE__ */ c(
          "div",
          {
            className: "w-full max-w-md rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-5 shadow-[var(--shadow-2)]",
            onClick: (u) => u.stopPropagation(),
            children: [
              /* @__PURE__ */ a("h3", { className: "text-sm font-semibold text-[var(--text-primary)]", children: i(
                s.action === "delete" ? "backup.confirmDeleteTitle" : "backup.confirmTitle"
              ) }),
              /* @__PURE__ */ a("p", { className: "mt-2 text-sm text-[var(--text-secondary)]", children: E(s.backup.timestamp) }),
              /* @__PURE__ */ a(
                "p",
                {
                  className: "mt-2 text-sm " + (s.action === "delete" ? "text-[var(--danger-text)]" : "text-[var(--text-tertiary)]"),
                  children: i(
                    s.action === "delete" ? "backup.confirmDeleteBody" : "backup.confirmKept"
                  )
                }
              ),
              /* @__PURE__ */ c("div", { className: "mt-4 flex justify-end gap-2", children: [
                /* @__PURE__ */ a(
                  "button",
                  {
                    onClick: () => o(null),
                    className: "rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-2)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)]",
                    children: i("save.cancel")
                  }
                ),
                /* @__PURE__ */ a(
                  "button",
                  {
                    onClick: () => {
                      p();
                    },
                    className: "rounded-[var(--radius-control)] px-3 py-1.5 text-sm font-medium text-white " + (s.action === "delete" ? "bg-[var(--danger)] hover:bg-[var(--danger)]" : "bg-accent hover:bg-[var(--accent-hover)]"),
                    children: i(
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
function E(e) {
  const t = Number(e);
  return Number.isFinite(t) ? new Date(t).toLocaleString(void 0, {
    dateStyle: "medium",
    timeStyle: "short"
  }) : e;
}
const me = {
  sm: "h-[var(--h-control-sm)] px-[var(--sp-5)] text-[length:var(--fs-body-sm)]",
  md: "h-[var(--h-control)] px-[var(--sp-6)] text-[length:var(--fs-body)]",
  lg: "h-[var(--h-control-lg)] px-[var(--sp-7)] text-[length:var(--fs-body)]"
}, fe = {
  primary: "border border-transparent bg-accent text-[var(--text-on-accent)] hover:bg-[var(--accent-hover)] hover:shadow-[var(--glow-soft)] active:bg-[var(--accent-press)] active:shadow-none",
  secondary: "border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]",
  ghost: "border border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
};
function z({
  variant: e = "primary",
  size: t = "md",
  className: r = "",
  ...n
}) {
  return /* @__PURE__ */ a(
    "button",
    {
      className: `inline-flex items-center justify-center gap-[var(--sp-3)] rounded-[var(--radius-control)] font-medium leading-none transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] focus-visible:shadow-[var(--ring-focus)] active:scale-[var(--press-scale)] disabled:pointer-events-none disabled:opacity-[0.42] ${me[t]} ${fe[e]} ${r}`,
      ...n
    }
  );
}
const _e = "cursor-pointer transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:-translate-y-px hover:border-[var(--border-accent)]";
function ge() {
  const e = "pointer-events-none absolute h-[10px] w-[10px] border-[var(--border-hud)]";
  return /* @__PURE__ */ c(L, { children: [
    /* @__PURE__ */ a("span", { "aria-hidden": !0, className: `${e} left-0 top-0 border-l-2 border-t-2` }),
    /* @__PURE__ */ a("span", { "aria-hidden": !0, className: `${e} right-0 top-0 border-r-2 border-t-2` }),
    /* @__PURE__ */ a("span", { "aria-hidden": !0, className: `${e} bottom-0 left-0 border-b-2 border-l-2` }),
    /* @__PURE__ */ a("span", { "aria-hidden": !0, className: `${e} bottom-0 right-0 border-b-2 border-r-2` })
  ] });
}
function he({
  variant: e = "standard",
  interactive: t = !1,
  className: r = "",
  children: n,
  ...i
}) {
  const s = t ? _e : "";
  return e === "hud" ? /* @__PURE__ */ c(
    "div",
    {
      className: `relative rounded-[var(--radius-xs)] border border-[var(--border-hud)] bg-[var(--surface-1)] p-[var(--pad-card)] ${s} ${r}`,
      ...i,
      children: [
        /* @__PURE__ */ a(ge, {}),
        n
      ]
    }
  ) : /* @__PURE__ */ a(
    "div",
    {
      className: `rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-[var(--pad-card)] shadow-[var(--shadow-1)] ${s} ${r}`,
      ...i,
      children: n
    }
  );
}
function be({ selected: e = !1, className: t = "", ...r }) {
  return /* @__PURE__ */ a(
    "button",
    {
      type: "button",
      "aria-pressed": e,
      className: `inline-flex items-center gap-[var(--sp-2)] rounded-[var(--radius-pill)] border px-[var(--sp-5)] py-[var(--sp-2)] text-[length:var(--fs-body-sm)] font-medium leading-none transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] focus-visible:shadow-[var(--ring-focus)] ${e ? "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--text-accent)]" : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:border-[var(--border-default)] hover:text-[var(--text-primary)]"} ${t}`,
      ...r
    }
  );
}
function Ie({
  filters: e,
  onChange: t,
  shown: r,
  total: n,
  conflictCount: i,
  unassignedCount: s
}) {
  const o = y();
  return /* @__PURE__ */ c("div", { className: "flex flex-wrap items-center gap-x-3 gap-y-2", children: [
    /* @__PURE__ */ a(
      "input",
      {
        type: "search",
        value: e.query,
        onChange: (d) => t({ ...e, query: d.target.value }),
        placeholder: o("filter.placeholder"),
        className: "min-w-56 flex-1 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-2)] px-[var(--sp-6)] py-[var(--sp-4)] text-[length:var(--fs-body-sm)] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:border-[var(--border-accent)] focus-visible:shadow-[var(--ring-focus)] focus:outline-none"
      }
    ),
    /* @__PURE__ */ a(
      A,
      {
        active: e.unassignedOnly,
        count: s,
        onClick: () => t({ ...e, unassignedOnly: !e.unassignedOnly }),
        children: o("filter.unassigned")
      }
    ),
    /* @__PURE__ */ a(
      A,
      {
        active: e.conflictsOnly,
        count: i,
        warn: !0,
        onClick: () => t({ ...e, conflictsOnly: !e.conflictsOnly }),
        children: o("filter.conflicts")
      }
    ),
    /* @__PURE__ */ a(
      A,
      {
        active: e.editableOnly,
        onClick: () => t({ ...e, editableOnly: !e.editableOnly }),
        children: o("filter.editableOnly")
      }
    ),
    /* @__PURE__ */ a("span", { className: "ml-auto whitespace-nowrap text-[length:var(--fs-caption)] text-[var(--text-tertiary)]", children: r === n ? `${n}` : `${r} / ${n}` }),
    D(e) && /* @__PURE__ */ a(
      "button",
      {
        onClick: () => t(j),
        className: "whitespace-nowrap text-[length:var(--fs-caption)] font-medium text-[var(--text-accent)] hover:text-[var(--accent-hover)]",
        children: o("filter.showAll")
      }
    )
  ] });
}
function A({
  active: e,
  count: t,
  warn: r,
  onClick: n,
  children: i
}) {
  const s = t === 0;
  return /* @__PURE__ */ c(
    be,
    {
      selected: e,
      onClick: n,
      disabled: s && !e,
      className: `${s && !e ? "opacity-[0.42]" : ""} ${r && e ? "!border-[var(--danger)] !bg-[var(--danger-soft)] !text-[var(--danger-text)]" : ""}`,
      children: [
        i,
        t !== void 0 && /* @__PURE__ */ a("span", { className: "tabular-nums text-[length:var(--fs-caption)] opacity-80", children: t })
      ]
    }
  );
}
function Pe({
  profilePath: e,
  profiles: t,
  onSelectProfile: r,
  onBrowse: n,
  onChanged: i
}) {
  const s = y(), [o, d] = f(null), [p, u] = f([]), [h, b] = f(null), [m, N] = f(null);
  O(() => {
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
      await g.setSettings(l), N(s("settings.saved")), b(null), i();
    } catch (_) {
      b(String(_));
    }
  }
  if (!o)
    return /* @__PURE__ */ a("p", { className: "text-[length:var(--fs-body-sm)] text-[var(--text-tertiary)]", children: s("settings.loading") });
  const w = "min-w-0 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-2)] px-[var(--sp-6)] py-[var(--sp-4)] text-[length:var(--fs-body-sm)] text-[var(--text-primary)] focus:border-[var(--border-accent)] focus-visible:shadow-[var(--ring-focus)] focus:outline-none";
  return /* @__PURE__ */ c("div", { className: "space-y-[var(--sp-6)]", children: [
    /* @__PURE__ */ c(S, { title: s("profile.title"), hint: s("profile.hint"), children: [
      /* @__PURE__ */ c("div", { className: "flex flex-wrap items-center gap-[var(--sp-4)]", children: [
        t.length > 0 ? /* @__PURE__ */ a(
          "select",
          {
            className: `flex-1 sm:flex-none ${w}`,
            value: e ?? "",
            onChange: (l) => r(l.target.value),
            children: t.map((l) => /* @__PURE__ */ a("option", { value: l.path, children: l.channel }, l.path))
          }
        ) : /* @__PURE__ */ a("p", { className: "text-[length:var(--fs-body-sm)] text-[var(--text-tertiary)]", children: s("profile.none") }),
        /* @__PURE__ */ a(z, { variant: "secondary", size: "sm", onClick: n, className: "shrink-0", children: s("profile.browse") })
      ] }),
      e && /* @__PURE__ */ a("p", { className: "technical mt-[var(--sp-4)] break-all text-[var(--text-disabled)]", children: e })
    ] }),
    /* @__PURE__ */ a(
      S,
      {
        title: s("settings.gameLanguage"),
        hint: s("settings.gameLanguageHint"),
        children: p.length === 0 ? /* @__PURE__ */ a("p", { className: "text-[length:var(--fs-body-sm)] text-[var(--text-tertiary)]", children: s("settings.noLanguages") }) : /* @__PURE__ */ a(
          "select",
          {
            className: `w-full max-w-sm ${w}`,
            value: o.game_language,
            onChange: (l) => {
              $({ ...o, game_language: l.target.value });
            },
            children: p.map((l) => /* @__PURE__ */ a("option", { value: l.id, children: l.label }, l.id))
          }
        )
      }
    ),
    /* @__PURE__ */ c(
      S,
      {
        title: s("settings.uiLanguage"),
        hint: s("settings.uiLanguageHint"),
        children: [
          /* @__PURE__ */ a("div", { className: "flex gap-[var(--sp-4)]", children: [
            { id: "fr", label: "Français" },
            { id: "en", label: "English" }
          ].map((l) => /* @__PURE__ */ a(
            z,
            {
              size: "sm",
              variant: o.ui_language === l.id ? "primary" : "secondary",
              onClick: () => {
                $({ ...o, ui_language: l.id });
              },
              children: l.label
            },
            l.id
          )) }),
          /* @__PURE__ */ a("p", { className: "mt-[var(--sp-4)] text-[length:var(--fs-caption)] text-[var(--text-tertiary)]", children: s("settings.installHint") })
        ]
      }
    ),
    m && /* @__PURE__ */ a("p", { className: "text-[length:var(--fs-body-sm)] text-[var(--success-text)]", children: m }),
    h && /* @__PURE__ */ a("p", { className: "text-[length:var(--fs-body-sm)] text-[var(--danger-text)]", children: h })
  ] });
}
function S({
  title: e,
  hint: t,
  children: r
}) {
  return /* @__PURE__ */ c(he, { children: [
    /* @__PURE__ */ a("h3", { className: "text-[length:var(--fs-body)] font-semibold text-[var(--text-primary)]", children: e }),
    /* @__PURE__ */ a("p", { className: "mb-[var(--sp-4)] mt-[var(--sp-1)] text-[length:var(--fs-caption)] text-[var(--text-tertiary)]", children: t }),
    r
  ] });
}
export {
  re as AXES,
  Ne as ContextRules,
  Ve as EditorToolbar,
  Ie as FilterBar,
  j as NO_FILTERS,
  Pe as SettingsPanel,
  Fe as TranslationProvider,
  X as actionLabel,
  g as api,
  ne as apply,
  Q as bindingLabel,
  le as build,
  qe as captureErrorMessage,
  De as capturedToken,
  Y as categoryLabel,
  Le as controlLabel,
  Se as controlsFor,
  Be as describe,
  Oe as devicePrefix,
  R as effectiveToken,
  Re as filters,
  Te as fromKeyPress,
  Ee as fromMouse,
  ze as fromWheel,
  Ae as groupLabel,
  te as hasConflict,
  $e as indexConflicts,
  ee as isAssigned,
  D as isFiltering,
  ke as isKnownAction,
  k as keyOf,
  V as modeOf,
  Me as modifierOf,
  Ce as rivalsOf,
  je as useCapture,
  y as useT
};
