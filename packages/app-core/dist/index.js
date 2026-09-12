import { invoke as b } from "@tauri-apps/api/core";
import { useState as k, useEffect as q, createContext as de, useContext as pe, useMemo as ve, useRef as H, useCallback as me, useId as T } from "react";
import { jsx as o, jsxs as m, Fragment as U } from "react/jsx-runtime";
import { createPortal as fe } from "react-dom";
function _e() {
  let e = Promise.resolve();
  return function(r) {
    const a = e.then(r);
    return e = a.catch(() => {
    }), a;
  };
}
const W = _e(), O = {
  listDevices: () => b("list_devices"),
  locateActionmaps: () => b("locate_actionmaps"),
  buildInfo: () => b("build_info"),
  /** Confronte le profil au matériel branché. */
  diagnoseDevices: (e) => b("diagnose_devices", { path: e }),
  /** Profils exportés présents dans `Controls\mappings`. */
  listLayouts: (e) => b("list_layouts", { path: e }),
  /** Détaille un profil exporté, sans rien y écrire. */
  inspectLayout: (e) => b("inspect_layout", { path: e }),
  /** Surcharges du joueur fusionnées avec les valeurs par défaut du jeu. */
  listEditableBindings: (e) => b("list_editable_bindings", { path: e }),
  /**
   * Écrit un lot de modifications en une seule fois.
   * Renvoie le chemin du point de restauration créé, ou `null`.
   */
  saveBindings: (e, t, r) => b("save_bindings", {
    path: e,
    edits: t,
    createRestorePoint: r
  }),
  /** Crée un point de restauration ; renvoie le chemin du fichier créé. */
  createBackup: (e) => b("create_backup", { path: e }),
  listBackups: () => b("list_backups"),
  /**
   * Supprime définitivement un point de restauration.
   *
   * Le backend refuse toute cible qui n'est pas une sauvegarde de SpaceMapper :
   * il détermine lui-même le dossier autorisé et ne se fie pas à ce chemin.
   */
  deleteBackup: (e) => b("delete_backup", { backupPath: e }),
  /** Langues réellement présentes dans l'installation du joueur. */
  listGameLanguages: (e) => b("list_game_languages", { path: e }),
  getSettings: () => b("get_settings"),
  setSettings: (e) => b("set_settings", { settings: e }),
  /**
   * Ouvre une session de lecture sur plusieurs périphériques à la fois.
   * Renvoie le numéro de session, à repasser à `stopCapture`.
   */
  startCapture: (e) => W(() => b("start_capture", { guids: e })),
  /** Dernier contrôle actionné, ou `null` si rien n'a été pressé. */
  pollCapture: () => b("poll_capture"),
  /** Frame live de la session désignée, vide dès que tout est relâché. */
  pollLiveCapture: (e) => b("poll_live_capture", { id: e }),
  /**
   * Oublie le dernier relevé et renvoie la séquence de la barrière native.
   * Un ancien binaire renvoie `null` (`()` sérialisé), d'où le repli typé.
   */
  clearCapture: () => b("clear_capture"),
  /** N'arrête que la session désignée : voir le commentaire côté Rust. */
  stopCapture: (e) => W(() => b("stop_capture", { id: e })),
  restoreBackup: (e, t) => b("restore_backup", { path: e, backupPath: t })
}, te = {
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
}, re = {
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
function ge(e) {
  return e.label ?? he(e.action);
}
function he(e) {
  const t = te[e];
  if (t) return t;
  const r = e.startsWith("emote_") ? re[e.slice(6)] : void 0;
  return r ? `Émote — ${r}` : e;
}
function st(e) {
  return e in te || e.startsWith("emote_") && e.slice(6) in re;
}
const be = {
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
function ye(e) {
  return be[e] ?? e;
}
const xe = /* @__PURE__ */ new Set(["x", "y", "z", "rotx", "roty", "rotz", "slider", "slider1", "slider2"]), M = ["onpress", "onhold", "onrelease"], K = {
  multitap: 1,
  presstriggerthreshold: -1,
  releasetriggerthreshold: -1,
  holdtriggerdelay: 0,
  releasetriggerdelay: 0
};
function J(e) {
  if (typeof e == "string" && !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(e.trim())) return null;
  const t = Number(e);
  return Number.isFinite(t) ? t : null;
}
function F(e, t) {
  const r = Object.fromEntries(Object.entries(e.trigger_attributes ?? {}).map(([d, v]) => [d.toLowerCase(), v]));
  e.multi_tap !== null && e.multi_tap !== void 0 && (r.multitap = e.multi_tap);
  const a = (t === void 0 ? e.input_raw ?? `${e.device ?? ""}_${e.control ?? ""}` : t ?? "").trim().toLowerCase(), n = /^(js|gp)\d+_(.+)$/.exec(a), i = n?.[2]?.split("+").at(-1)?.trim();
  if (n && i && xe.has(i))
    return ["0", "false"].includes(String(r.useanalogcompare ?? "0").trim().toLowerCase()) ? { kind: "continuous_axis" } : null;
  if (!M.some((d) => d in r)) return null;
  const s = {};
  for (const d of M) {
    const v = String(r[d] ?? "0").trim().toLowerCase();
    if (["true", "false"].includes(v)) s[d] = v === "true";
    else {
      const c = J(v);
      if (c !== 0 && c !== 1) return null;
      s[d] = c === 1;
    }
  }
  if (!M.some((d) => s[d])) return null;
  const l = {};
  for (const [d, v] of Object.entries(K)) {
    const c = J(r[d] ?? v);
    if (c === null) return null;
    l[d] = c;
  }
  return { kind: "button", ...s, ...l };
}
function B(e) {
  if (typeof e != "object" || e === null) return null;
  const t = e;
  return t.kind === "continuous_axis" ? "continuous_axis" : t.kind !== "button" || M.some((r) => typeof t[r] != "boolean") || !M.some((r) => t[r]) || Object.keys(K).some((r) => typeof t[r] != "number" || !Number.isFinite(t[r])) ? null : JSON.stringify(["button", ...M.map((r) => t[r]), ...Object.keys(K).map((r) => t[r])]);
}
const ke = /* @__PURE__ */ new Set(["tap", "tap_quicker"]), we = /* @__PURE__ */ new Set(["", "press", "press_quicker", "hold", "hold_toggle", "hold_no_retrigger", "all", "smart_toggle"]), Ne = /* @__PURE__ */ new Set([
  "delayed_press",
  "delayed_press_quicker",
  "delayed_press_medium",
  "delayed_press_long",
  "delayed_hold",
  "delayed_hold_long",
  "delayed_hold_no_retrigger"
]), $e = /* @__PURE__ */ new Set(["double_tap", "double_tap_nonblocking"]);
function Ce(e) {
  const t = e.multi_tap?.trim();
  if (t) {
    if (!/^\d+$/.test(t)) return "unknown";
    const a = Number.parseInt(t, 10);
    if (a > 1) return `multi_tap:${a}`;
    if (a < 1) return "unknown";
  }
  const r = (e.activation_mode ?? "").trim().toLowerCase();
  return we.has(r) ? "immediate" : ke.has(r) ? "short_press" : Ne.has(r) ? "long_press" : $e.has(r) ? "multi_tap:2" : "unknown";
}
function it(e, t) {
  if (e.trigger_attributes !== void 0 || t.trigger_attributes !== void 0) {
    const i = B(F(e)), s = B(F(t));
    return i === null || s === null || i === s;
  }
  const r = (i) => {
    const s = Ce(i);
    return s === "immediate" ? "short_press" : s;
  }, a = r(e), n = r(t);
  return a === "unknown" || n === "unknown" || a === n;
}
const Se = {
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
function lt(e, t, r) {
  const a = t ? Number.parseInt(t, 10) : NaN;
  if (a > 1)
    return {
      label: a === 2 ? r("activation.doubleTap") : `${r("activation.multiTap")} ×${a}`,
      kind: "tap"
    };
  if (!e || e === "press")
    return null;
  const n = Se[e];
  return n ? { label: r(n.key), kind: n.kind } : { label: e, kind: "other" };
}
class ct {
  pairs;
  loaded;
  constructor(t) {
    this.loaded = t !== null, this.pairs = new Set(
      (t ?? []).flatMap(([r, a]) => [`${r}|${a}`, `${a}|${r}`])
    );
  }
  canCollide(t, r) {
    return this.loaded ? this.pairs.has(`${t}|${r}`) : !0;
  }
}
function E(e) {
  return `${e.actionmap}/${e.action}/${e.input_raw}`;
}
function z(e, t) {
  const r = E(e);
  return t.has(r) ? t.get(r) ?? null : e.control && e.control.trim() !== "" ? e.input_raw : null;
}
function Le(e, t) {
  return z(e, t) !== null;
}
function D(e) {
  const t = e.trim().toLowerCase(), r = /^((?:js|gp|kb|mo)\d+)_(.*)$/.exec(t);
  if (!r) return t;
  const a = r[2].split("+").map((i) => i.trim()), n = a.pop() ?? "";
  return `${r[1]}_${[...a.sort(), n].join("+")}`;
}
function ae(e, t) {
  if (t.length !== 2) return null;
  const r = t.map((a) => {
    const n = B(a.trigger_signature);
    return n === null ? null : JSON.stringify([a.actionmap, a.action, n]);
  });
  return r.some((a) => a === null) ? null : JSON.stringify([D(e), ...r.sort()]);
}
const X = /* @__PURE__ */ new WeakMap();
function Ae(e) {
  const t = X.get(e);
  if (t) return t;
  const r = /* @__PURE__ */ new Map();
  for (const a of e) {
    if (a.verdict !== "false_alarm" && a.verdict !== "real_conflict") continue;
    const n = ae(a.control, a.actions);
    n !== null && r.set(n, a);
  }
  return X.set(e, r), r;
}
function Oe(e, t, r, a, n = []) {
  const i = z(e, r), s = z(t, r);
  if (i === null || s === null || D(i) !== D(s)) return { level: "none", reason: "different_controls" };
  if (e.actionmap === t.actionmap && e.action === t.action) return { level: "none", reason: "same_action" };
  const l = F(e, i), d = F(t, s), v = ae(i, [
    { actionmap: e.actionmap, action: e.action, trigger_signature: l },
    { actionmap: t.actionmap, action: t.action, trigger_signature: d }
  ]);
  if (v !== null) {
    const c = Ae(n).get(v);
    if (c) return c.verdict === "real_conflict" ? { level: "probable", reason: "review_real_conflict" } : { level: "none", reason: "review_false_alarm" };
  }
  return l !== null && d !== null && B(l) !== B(d) ? { level: "none", reason: "different_triggers" } : a.canCollide(e.context, t.context) ? l === null || d === null ? { level: "uncertain", reason: "unknown_trigger" } : e.origin === "game_default" && t.origin === "game_default" && !r.has(E(e)) && !r.has(E(t)) ? { level: "uncertain", reason: "preexisting_default" } : { level: "probable", reason: "same_usage" } : { level: "none", reason: "separate_contexts" };
}
function Z(e, t, r, a, n = []) {
  return Oe(e, t, r, a, n).level;
}
function ut(e, t, r, a = []) {
  const n = /* @__PURE__ */ new Map();
  for (const c of e) {
    const g = z(c, t);
    if (g === null) continue;
    const y = D(g), h = n.get(y);
    h ? h.push(c) : n.set(y, [c]);
  }
  const i = /* @__PURE__ */ new Set(), s = /* @__PURE__ */ new Set(), l = /* @__PURE__ */ new Map(), d = /* @__PURE__ */ new Map(), v = (c, g, y) => {
    const h = E(g), f = c.get(h) ?? [];
    f.push(y), c.set(h, f);
  };
  for (const [, c] of n)
    for (let g = 0; g < c.length; g++)
      for (let y = g + 1; y < c.length; y++) {
        const h = c[g], f = c[y], _ = Z(h, f, t, r, a);
        if (_ === "none") continue;
        const $ = _ === "probable" ? i : s, S = _ === "probable" ? l : d;
        $.add(E(h)), $.add(E(f)), v(S, h, f), v(S, f, h);
      }
  return { byToken: n, rules: r, flagged: i, uncertain: s, reviews: a, probableRivals: l, uncertainRivals: d };
}
function dt(e, t, r) {
  const a = z(e, t);
  return a === null ? [] : (r.byToken.get(D(a)) ?? []).filter(
    (n) => n !== e && Z(e, n, t, r.rules, r.reviews) === "probable"
  );
}
function pt(e, t, r) {
  const a = z(e, t);
  return a === null ? [] : (r.byToken.get(D(a)) ?? []).filter(
    (n) => n !== e && Z(e, n, t, r.rules, r.reviews) === "uncertain"
  );
}
function vt(e, t, r) {
  return r.uncertain.has(E(e));
}
function Re(e, t, r) {
  return r.flagged.has(E(e));
}
const Ee = ["x", "y", "z", "rotx", "roty", "rotz", "slider1", "slider2"], Te = ["up", "right", "down", "left"];
function mt(e, t) {
  switch (e) {
    case "buttons":
      return t("control.buttons");
    case "axes":
      return t("control.axes");
    case "hats":
      return t("control.hats");
  }
}
function ft(e, t) {
  const r = [];
  for (let a = 1; a <= e.buttons; a++)
    r.push({
      value: `button${a}`,
      label: `${t("control.button")} ${a}`,
      group: "buttons"
    });
  for (const a of Ee.slice(0, e.axes))
    r.push({
      value: a,
      label: `${t("control.axis")} ${a}`,
      group: "axes"
    });
  for (let a = 1; a <= e.povs; a++)
    for (const n of Te)
      r.push({
        value: `hat${a}_${n}`,
        label: `${t("control.hat")} ${a} — ${ne(n, t)}`,
        group: "hats"
      });
  return r;
}
function _t(e, t) {
  const r = /^button(\d+)$/.exec(e);
  if (r) return `${t("control.button")} ${r[1]}`;
  const a = /^hat(\d+)_(\w+)$/.exec(e);
  if (a)
    return `${t("control.hat")} ${a[1]} — ${ne(a[2], t)}`;
  const n = /^slider(\d+)$/.exec(e);
  return n ? `${t("control.slider")} ${n[1]}` : `${t("control.axis")} ${e}`;
}
function ne(e, t) {
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
function gt(e, t) {
  const a = e.filter((i) => i.category === t.category).findIndex(
    (i) => i.instance_guid === t.instance_guid
  );
  return `${t.category === "gamepad" ? "gp" : "js"}${a + 1}`;
}
const oe = {
  query: "",
  unassignedOnly: !1,
  conflictsOnly: !1,
  editableOnly: !1
};
function se(e) {
  return e.query.trim() !== "" || e.unassignedOnly || e.conflictsOnly || e.editableOnly;
}
function ie(e) {
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
function Me(e, t, r, a, n) {
  const i = Y(t.query);
  return e.filter((s) => {
    const l = Le(s, a);
    return r !== "all" && l && ie(s) !== r || t.unassignedOnly && l || t.conflictsOnly && !Re(s, a, n) || t.editableOnly && s.lock ? !1 : i === "" ? !0 : [
      ge(s),
      s.action,
      s.description ?? "",
      s.input_raw,
      s.control ?? "",
      ye(s.actionmap),
      s.actionmap
    ].some((d) => Y(d).includes(i));
  });
}
function Y(e) {
  return e.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}
const ht = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  NO_FILTERS: oe,
  apply: Me,
  isFiltering: se,
  modeOf: ie
}, Symbol.toStringTag, { value: "Module" })), qe = {
  ShiftLeft: "lshift",
  ShiftRight: "rshift",
  ControlLeft: "lctrl",
  ControlRight: "rctrl",
  AltLeft: "lalt",
  AltRight: "ralt"
}, ze = {
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
}, De = {
  0: "mouse1",
  1: "mouse3",
  2: "mouse2",
  3: "mouse4",
  4: "mouse5"
};
function bt(e) {
  return qe[e] ?? null;
}
function Ie(e, t) {
  return { token: `kb1_${e ? `${e}+${t}` : t}`, modifier: e, control: t };
}
function yt(e, t) {
  if (t.length > 1)
    return { ok: !1, error: { kind: "too_many_modifiers" } };
  const r = Be(e);
  return r ? { ok: !0, value: Ie(t[0] ?? null, r) } : { ok: !1, error: { kind: "unsupported", code: e } };
}
function xt(e, t) {
  if (t.length > 1)
    return { ok: !1, error: { kind: "too_many_modifiers" } };
  const r = De[e];
  return r ? { ok: !0, value: le(t[0] ?? null, r) } : { ok: !1, error: { kind: "unsupported", code: `mouse${e}` } };
}
function kt(e, t) {
  if (t.length > 1)
    return { ok: !1, error: { kind: "too_many_modifiers" } };
  if (e === 0)
    return { ok: !1, error: { kind: "unsupported", code: "mwheel" } };
  const r = e < 0 ? "mwheel_up" : "mwheel_down";
  return { ok: !0, value: le(t[0] ?? null, r) };
}
function le(e, t) {
  return { token: `mo1_${e ? `${e}+${t}` : t}`, modifier: e, control: t };
}
function Be(e) {
  return /^Key[A-Z]$/.test(e) ? e.slice(3).toLowerCase() : /^Digit[0-9]$/.test(e) ? e.slice(5) : /^F([1-9]|1[0-2])$/.test(e) ? e.toLowerCase() : /^Numpad[0-9]$/.test(e) ? `np_${e.slice(6)}` : ze[e] ?? null;
}
function je(e) {
  return /^[a-z]$/.test(e) ? `Key${e.toUpperCase()}` : /^[0-9]$/.test(e) ? `Digit${e}` : null;
}
function wt() {
  const [e, t] = k(null);
  return q(() => {
    let r = !1;
    const a = navigator.keyboard;
    if (a?.getLayoutMap)
      return a.getLayoutMap().then((n) => {
        r || t(n);
      }).catch(() => {
      }), () => {
        r = !0;
      };
  }, []), e;
}
const Fe = {
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
function ce(e, t) {
  const r = Fe[e];
  return r ? t(r) : e.startsWith("np_") ? `${t("key.numpad")} ${e.slice(3)}` : e.toUpperCase();
}
function Ve(e, t, r) {
  if (t && /^[a-z0-9]$/.test(e)) {
    const a = je(e), n = a ? t.get(a) : void 0;
    if (n && /^[a-z0-9]$/i.test(n)) return n.toUpperCase();
  }
  return ce(e, r);
}
function Nt(e, t, r) {
  const a = Ve(e.control, r ?? null, t);
  return e.modifier ? `${ce(e.modifier, t)} + ${a}` : a;
}
function $t(e, t) {
  switch (e.kind) {
    case "too_many_modifiers":
      return t("capture.tooManyModifiers");
    case "unsupported":
      return `${t("capture.unsupported")} (${e.code})`;
  }
}
const ue = de((e) => e);
function Ct({
  translate: e,
  children: t
}) {
  const r = ve(() => e, [e]);
  return /* @__PURE__ */ o(ue.Provider, { value: r, children: t });
}
function I() {
  return pe(ue);
}
const Ge = 32;
function St(e, t) {
  const [r, a] = k(() => !document.hidden);
  q(() => {
    const p = () => a(!document.hidden), x = (L) => a(L.detail);
    return document.addEventListener("visibilitychange", p), window.addEventListener("spacemapper:visibility", x), () => {
      document.removeEventListener("visibilitychange", p), window.removeEventListener("spacemapper:visibility", x);
    };
  }, []);
  const [n, i] = k(null), [s, l] = k([]), [d, v] = k(0), [c, g] = k(void 0), [y, h] = k(!1), [f, _] = k(null), $ = H(null), S = e.map((p) => p.instance_guid).join("|");
  q(() => {
    if (i(null), l([]), v(0), g(void 0), h(!1), _(null), !t || !r || S === "") return;
    let p = null, x = -1, L = 0;
    const C = O.startCapture(S.split("|")), N = {
      cancelled: !1,
      resetGeneration: 0,
      pendingResets: 0,
      started: C,
      resetQueue: Promise.resolve()
    };
    return $.current = N, C.then(
      (u) => {
        if (N.cancelled) return;
        h(!0);
        const A = async () => {
          if (N.cancelled) return;
          const j = N.resetGeneration;
          if (N.pendingResets === 0)
            try {
              const R = await O.pollLiveCapture(u);
              !N.cancelled && R.session_id === u && j === N.resetGeneration && N.pendingResets === 0 && (L !== j && (L = j, x = -1), R.sequence > x && (x = R.sequence, l(R.inputs), v(R.sequence), g(R.capture_ready), i(
                (Q) => Pe(Q, R.last) ? Q : R.last
              )), _(null), h(!0));
            } catch (R) {
              !N.cancelled && j === N.resetGeneration && (_(String(R)), h(!1), l([]), g(void 0), x = -1);
            }
          N.cancelled || (p = window.setTimeout(A, Ge));
        };
        A();
      },
      (u) => !N.cancelled && _(String(u))
    ), () => {
      N.cancelled = !0, $.current === N && ($.current = null), p !== null && window.clearTimeout(p), C.then((u) => O.stopCapture(u)).catch(() => {
      });
    };
  }, [S, t, r]);
  const w = me(async () => {
    i(null), l([]), g(void 0);
    const p = $.current;
    if (!p || p.cancelled) return null;
    p.resetGeneration += 1, p.pendingResets += 1;
    const x = p.resetQueue.then(async () => (await p.started, p.cancelled ? null : O.clearCapture()));
    p.resetQueue = x.then(() => {
    }, () => {
    });
    try {
      return await x;
    } catch (L) {
      return p.cancelled || _(String(L)), null;
    } finally {
      p.pendingResets -= 1, p.resetGeneration += 1, p.cancelled || (i(null), l([]), g(void 0));
    }
  }, []);
  return {
    last: n,
    active: s,
    frameSequence: d,
    captureReady: c,
    listening: y,
    error: f,
    // L'oubli doit aussi porter côté Rust : le thread garde son relevé, et le
    // sondage suivant le restaurerait aussitôt.
    reset: w
  };
}
function Pe(e, t) {
  return e === t || e !== null && t !== null && e.guid === t.guid && e.control === t.control && e.detected_sequence === t.detected_sequence;
}
function Lt(e, t, r) {
  if (!e) return null;
  const a = t.find((n) => n.instance_guid === e.guid);
  return a ? `${r(a)}_${e.control}` : null;
}
function At({
  profilePath: e,
  mode: t,
  onModeChange: r,
  listening: a,
  deviceCount: n,
  captureError: i,
  probe: s,
  onClearProbe: l,
  onRestored: d
}) {
  const v = I(), [c, g] = k([]), [y, h] = k(!1), [f, _] = k(!1), [$, S] = k(null), w = T();
  async function p() {
    try {
      g(await O.listBackups());
    } catch {
    }
  }
  q(() => {
    p();
  }, []);
  async function x() {
    _(!0);
    try {
      await O.createBackup(e), S(v("backup.created")), await p();
    } catch (C) {
      S(String(C));
    } finally {
      _(!1);
    }
  }
  const L = [
    { id: "all", label: "filter.mode.all" },
    { id: "desk", label: "filter.mode.desk" },
    { id: "gamepad", label: "filter.mode.gamepad" },
    { id: "joystick", label: "filter.mode.joystick" }
  ];
  return /* @__PURE__ */ m("div", { className: "space-y-2", children: [
    /* @__PURE__ */ m("div", { className: "app-panel app-panel--hud flex flex-wrap items-center gap-x-4 gap-y-2 !overflow-visible rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] px-3 py-2", children: [
      /* @__PURE__ */ m("div", { className: "-mx-1 flex max-w-full items-center gap-1 overflow-x-auto overflow-y-hidden px-1", children: [
        /* @__PURE__ */ o("span", { className: "mr-1 shrink-0 text-xs font-medium text-[var(--text-tertiary)]", children: v("filter.mode") }),
        L.map((C) => /* @__PURE__ */ o(
          "button",
          {
            type: "button",
            onClick: () => r(C.id),
            "aria-pressed": t === C.id,
            className: "shrink-0 whitespace-nowrap rounded-[var(--radius-control)] px-2.5 py-1 text-xs font-medium transition-colors " + (t === C.id ? "bg-accent text-white" : "text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]"),
            children: v(C.label)
          },
          C.id
        ))
      ] }),
      /* @__PURE__ */ m("div", { className: "flex flex-wrap items-center gap-3 sm:ml-auto", children: [
        /* @__PURE__ */ o(
          He,
          {
            listening: a,
            count: n,
            error: i,
            probe: s,
            onClear: l
          }
        ),
        /* @__PURE__ */ m("div", { className: "relative", children: [
          /* @__PURE__ */ m("div", { className: "flex items-center rounded-[var(--radius-control)] border border-[var(--border-default)]", children: [
            /* @__PURE__ */ o(
              "button",
              {
                type: "button",
                onClick: () => {
                  x();
                },
                disabled: f,
                className: "rounded-l-md px-2.5 py-1 text-xs font-medium text-[var(--text-primary)] hover:bg-[var(--surface-hover)] disabled:text-[var(--text-disabled)]",
                children: v("backup.create")
              }
            ),
            /* @__PURE__ */ m(
              "button",
              {
                type: "button",
                onClick: () => h((C) => !C),
                "aria-controls": w,
                "aria-expanded": y,
                "aria-haspopup": "dialog",
                "aria-label": `${v("backup.title")}: ${c.length}`,
                className: "border-l border-[var(--border-default)] px-2 py-1 text-xs text-[var(--text-secondary)] hover:bg-[var(--surface-hover)]",
                title: v("backup.title"),
                children: [
                  c.length,
                  " ▾"
                ]
              }
            )
          ] }),
          y && /* @__PURE__ */ o(
            Ue,
            {
              id: w,
              profilePath: e,
              backups: c,
              onClose: () => h(!1),
              onChanged: async () => {
                await p(), d();
              }
            }
          )
        ] }),
        /* @__PURE__ */ o(Ke, {})
      ] })
    ] }),
    $ && /* @__PURE__ */ o("p", { className: "rounded-[var(--radius-control)] bg-[var(--accent-soft)] px-3 py-1.5 text-xs text-[var(--text-accent)]", children: $ })
  ] });
}
function He({
  listening: e,
  count: t,
  error: r,
  probe: a,
  onClear: n
}) {
  const i = I();
  return r ? /* @__PURE__ */ o("span", { className: "text-xs text-[var(--danger-text)]", title: r, children: i("probe.stopped") }) : a ? /* @__PURE__ */ m("span", { className: "flex items-center gap-1.5 rounded-[var(--radius-control)] bg-[var(--accent-soft)] px-2 py-1 text-xs text-[var(--text-accent)]", children: [
    /* @__PURE__ */ o("span", { className: "font-mono font-semibold", children: a.device }),
    /* @__PURE__ */ o("span", { children: a.control }),
    /* @__PURE__ */ o("span", { className: "text-[var(--text-accent)]", children: "·" }),
    /* @__PURE__ */ o("span", { children: a.matches === 0 ? i("probe.noMatch") : `${a.matches} ${i(
      a.matches > 1 ? "probe.matchMany" : "probe.matchOne"
    )}` }),
    /* @__PURE__ */ o(
      "button",
      {
        type: "button",
        onClick: n,
        className: "ml-1 text-[var(--text-accent)] hover:text-[var(--accent-hover)]",
        children: i("probe.clear")
      }
    )
  ] }) : /* @__PURE__ */ m(
    "span",
    {
      className: "flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]",
      title: i("probe.idle"),
      children: [
        /* @__PURE__ */ o(
          "span",
          {
            className: "inline-block h-1.5 w-1.5 rounded-full " + (e ? "bg-[var(--accent)]" : "bg-[var(--border-default)]")
          }
        ),
        t,
        " ",
        i(t > 1 ? "probe.deviceMany" : "probe.deviceOne")
      ]
    }
  );
}
function Ke() {
  const e = I(), [t, r] = k(!1), a = T();
  return /* @__PURE__ */ m("div", { className: "relative", children: [
    /* @__PURE__ */ o(
      "button",
      {
        type: "button",
        onClick: () => r((n) => !n),
        "aria-controls": a,
        "aria-expanded": t,
        "aria-haspopup": "dialog",
        "aria-label": e("scope.title"),
        className: "flex h-[var(--tap-min)] w-[var(--tap-min)] items-center justify-center rounded-full border border-[var(--border-default)] text-xs text-[var(--text-tertiary)] hover:bg-[var(--surface-hover)]",
        title: e("scope.title"),
        children: /* @__PURE__ */ o("span", { "aria-hidden": !0, children: "?" })
      }
    ),
    t && /* @__PURE__ */ m(U, { children: [
      /* @__PURE__ */ o("div", { className: "fixed inset-0 z-10", onClick: () => r(!1) }),
      /* @__PURE__ */ m(
        "div",
        {
          id: a,
          role: "dialog",
          "aria-label": e("scope.title"),
          className: "absolute right-0 z-20 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-3 shadow-[var(--shadow-2)]",
          children: [
            /* @__PURE__ */ o("h4", { className: "text-xs font-semibold text-[var(--text-primary)]", children: e("scope.title") }),
            /* @__PURE__ */ o("p", { className: "mt-1 text-xs text-[var(--text-secondary)]", children: e("scope.editable") }),
            /* @__PURE__ */ o("p", { className: "mt-2 text-xs text-[var(--text-secondary)]", children: e("scope.defaults") }),
            /* @__PURE__ */ o("p", { className: "mt-2 text-xs text-[var(--danger-text)]", children: e("scope.closeGame") })
          ]
        }
      )
    ] })
  ] });
}
function Ue({
  id: e,
  profilePath: t,
  backups: r,
  onClose: a,
  onChanged: n
}) {
  const i = I(), [s, l] = k(null), d = H(null), v = T(), c = T(), g = H(null), y = s !== null;
  q(() => {
    if (!y) return;
    const f = document.activeElement instanceof HTMLElement ? document.activeElement : null, _ = g.current;
    if (!_) return;
    const $ = () => Array.from(_.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    ));
    ($()[0] ?? _).focus();
    function S(w) {
      if (w.key === "Escape")
        w.preventDefault(), w.stopPropagation(), l(null);
      else if (w.key === "Tab") {
        const p = $(), x = p[0], L = p[p.length - 1];
        !x || !L ? (w.preventDefault(), _.focus()) : w.shiftKey && document.activeElement === x ? (w.preventDefault(), L.focus()) : !w.shiftKey && document.activeElement === L && (w.preventDefault(), x.focus());
      }
    }
    return document.addEventListener("keydown", S), () => {
      document.removeEventListener("keydown", S), f?.focus();
    };
  }, [y]);
  async function h() {
    if (!s) return;
    const { backup: f, action: _ } = s;
    l(null);
    try {
      _ === "restore" ? await O.restoreBackup(t, f.path) : await O.deleteBackup(f.path), n();
    } catch {
    }
    a();
  }
  return /* @__PURE__ */ m(U, { children: [
    /* @__PURE__ */ o("div", { className: "fixed inset-0 z-10", onClick: a }),
    /* @__PURE__ */ m(
      "div",
      {
        id: e,
        ref: d,
        role: "dialog",
        "aria-label": i("backup.title"),
        className: "absolute left-0 z-20 mt-1 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] shadow-[var(--shadow-2)] sm:left-auto sm:right-0",
        children: [
          /* @__PURE__ */ o("p", { className: "border-b border-[var(--border-subtle)] px-3 py-2 text-xs text-[var(--text-tertiary)]", children: i("backup.hint") }),
          r.length === 0 ? /* @__PURE__ */ o("p", { className: "px-3 py-4 text-center text-xs text-[var(--text-tertiary)]", children: i("backup.empty") }) : /* @__PURE__ */ o("ul", { className: "max-h-64 divide-y divide-[var(--border-subtle)] overflow-y-auto", children: r.map((f) => /* @__PURE__ */ m("li", { className: "px-3 py-2", children: [
            /* @__PURE__ */ o("p", { className: "text-xs text-[var(--text-primary)]", children: ee(f.timestamp) }),
            /* @__PURE__ */ m("div", { className: "mt-1 flex gap-2", children: [
              /* @__PURE__ */ o(
                "button",
                {
                  type: "button",
                  onClick: () => l({ backup: f, action: "restore" }),
                  className: "text-xs font-medium text-[var(--text-accent)] hover:text-[var(--accent-hover)]",
                  children: i("backup.restore")
                }
              ),
              /* @__PURE__ */ o(
                "button",
                {
                  type: "button",
                  onClick: () => l({ backup: f, action: "delete" }),
                  className: "text-xs text-[var(--text-tertiary)] hover:text-[var(--danger-text)]",
                  children: i("backup.delete")
                }
              )
            ] })
          ] }, f.path)) })
        ]
      }
    ),
    s && fe(
      /* @__PURE__ */ o(
        "div",
        {
          className: "fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[var(--scrim)] p-4 sm:p-8",
          onClick: () => l(null),
          children: /* @__PURE__ */ m(
            "div",
            {
              ref: g,
              tabIndex: -1,
              role: "dialog",
              "aria-modal": "true",
              "aria-labelledby": v,
              "aria-describedby": c,
              className: "max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-h-[calc(100dvh-4rem)] w-full max-w-md rounded-[var(--radius-card)] border border-[var(--border-subtle)] bg-[var(--surface-2)] p-5 shadow-[var(--shadow-2)]",
              onClick: (f) => f.stopPropagation(),
              children: [
                /* @__PURE__ */ o(
                  "h3",
                  {
                    id: v,
                    className: "text-sm font-semibold text-[var(--text-primary)]",
                    children: i(
                      s.action === "delete" ? "backup.confirmDeleteTitle" : "backup.confirmTitle"
                    )
                  }
                ),
                /* @__PURE__ */ o("p", { className: "mt-2 text-sm text-[var(--text-secondary)]", children: ee(s.backup.timestamp) }),
                /* @__PURE__ */ o(
                  "p",
                  {
                    id: c,
                    className: "mt-2 text-sm " + (s.action === "delete" ? "text-[var(--danger-text)]" : "text-[var(--text-tertiary)]"),
                    children: i(
                      s.action === "delete" ? "backup.confirmDeleteBody" : "backup.confirmKept"
                    )
                  }
                ),
                /* @__PURE__ */ m("div", { className: "mt-4 flex justify-end gap-2", children: [
                  /* @__PURE__ */ o(
                    "button",
                    {
                      type: "button",
                      onClick: () => l(null),
                      className: "rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-2)] px-3 py-1.5 text-sm text-[var(--text-primary)] hover:bg-[var(--surface-hover)]",
                      children: i("save.cancel")
                    }
                  ),
                  /* @__PURE__ */ o(
                    "button",
                    {
                      type: "button",
                      onClick: () => {
                        h();
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
      ),
      document.body
    )
  ] });
}
function ee(e) {
  const t = Number(e);
  return Number.isFinite(t) ? new Date(t).toLocaleString(void 0, {
    dateStyle: "medium",
    timeStyle: "short"
  }) : e;
}
const Ze = {
  sm: "h-[var(--h-control-sm)] px-[var(--sp-5)] text-[length:var(--fs-body-sm)]",
  md: "h-[var(--h-control)] px-[var(--sp-6)] text-[length:var(--fs-body)]",
  lg: "h-[var(--h-control-lg)] px-[var(--sp-7)] text-[length:var(--fs-body)]"
}, Qe = {
  primary: "border border-transparent bg-accent text-[var(--text-on-accent)] hover:border-[var(--blue-300)] hover:bg-accent hover:shadow-[var(--glow-soft)] active:border-transparent active:bg-[var(--accent-press)] active:shadow-none",
  secondary: "border border-[var(--border-default)] bg-[var(--surface-2)] text-[var(--text-primary)] hover:border-[var(--border-strong)] hover:bg-[var(--surface-hover)]",
  ghost: "border border-transparent bg-transparent text-[var(--text-secondary)] hover:bg-[var(--surface-hover)] hover:text-[var(--text-primary)]"
};
function V({
  variant: e = "primary",
  size: t = "md",
  className: r = "",
  ...a
}) {
  return /* @__PURE__ */ o(
    "button",
    {
      className: `inline-flex items-center justify-center gap-[var(--sp-3)] rounded-[var(--radius-control)] font-medium leading-none transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] focus-visible:shadow-[var(--ring-focus)] active:scale-[var(--press-scale)] disabled:pointer-events-none disabled:opacity-[0.42] ${Ze[t]} ${Qe[e]} ${r}`,
      ...a
    }
  );
}
const We = "cursor-pointer transition-transform duration-[var(--dur-fast)] ease-[var(--ease-out)] hover:-translate-y-px hover:border-[var(--border-accent)]";
function Je() {
  const e = "pointer-events-none absolute h-[10px] w-[10px] border-[var(--border-hud)]";
  return /* @__PURE__ */ m(U, { children: [
    /* @__PURE__ */ o("span", { "aria-hidden": !0, className: `${e} left-0 top-0 border-l-2 border-t-2` }),
    /* @__PURE__ */ o("span", { "aria-hidden": !0, className: `${e} right-0 top-0 border-r-2 border-t-2` }),
    /* @__PURE__ */ o("span", { "aria-hidden": !0, className: `${e} bottom-0 left-0 border-b-2 border-l-2` }),
    /* @__PURE__ */ o("span", { "aria-hidden": !0, className: `${e} bottom-0 right-0 border-b-2 border-r-2` })
  ] });
}
function Xe({
  variant: e = "standard",
  interactive: t = !1,
  className: r = "",
  children: a,
  ...n
}) {
  const i = t ? We : "";
  return e === "hud" ? /* @__PURE__ */ m(
    "div",
    {
      className: `pk-card pk-card--hud relative rounded-[var(--radius-xs)] border border-[var(--border-hud)] bg-[var(--surface-1)] p-[var(--pad-card)] ${i} ${r}`,
      ...n,
      children: [
        /* @__PURE__ */ o(Je, {}),
        a
      ]
    }
  ) : /* @__PURE__ */ o(
    "div",
    {
      className: `pk-card rounded-[var(--radius-md)] border border-[var(--border-subtle)] bg-[var(--surface-1)] p-[var(--pad-card)] shadow-[var(--shadow-1)] ${i} ${r}`,
      ...n,
      children: a
    }
  );
}
function Ye({ selected: e = !1, className: t = "", ...r }) {
  return /* @__PURE__ */ o(
    "button",
    {
      type: "button",
      "aria-pressed": e,
      className: `inline-flex items-center gap-[var(--sp-2)] rounded-[var(--radius-pill)] border px-[var(--sp-5)] py-[var(--sp-2)] text-[length:var(--fs-body-sm)] font-medium leading-none transition-all duration-[var(--dur-fast)] ease-[var(--ease-out)] focus-visible:shadow-[var(--ring-focus)] ${e ? "border-[var(--border-accent)] bg-[var(--accent-soft)] text-[var(--text-accent)]" : "border-[var(--border-subtle)] bg-[var(--surface-2)] text-[var(--text-secondary)] hover:border-[var(--border-default)] hover:text-[var(--text-primary)]"} ${t}`,
      ...r
    }
  );
}
function Ot({
  filters: e,
  onChange: t,
  shown: r,
  total: a,
  conflictCount: n,
  unassignedCount: i,
  showEditableFilter: s = !0
}) {
  const l = I();
  return /* @__PURE__ */ m("div", { className: "app-panel flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2", children: [
    /* @__PURE__ */ o(
      "input",
      {
        type: "search",
        "aria-label": l("filter.placeholder"),
        value: e.query,
        onChange: (d) => t({ ...e, query: d.target.value }),
        placeholder: l("filter.placeholder"),
        className: "min-w-56 flex-1 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-2)] px-[var(--sp-6)] py-[var(--sp-4)] text-[length:var(--fs-body-sm)] text-[var(--text-primary)] placeholder:text-[var(--text-disabled)] focus:border-[var(--border-accent)] focus-visible:shadow-[var(--ring-focus)] focus:outline-none"
      }
    ),
    /* @__PURE__ */ o(
      G,
      {
        active: e.unassignedOnly,
        count: i,
        onClick: () => t({ ...e, unassignedOnly: !e.unassignedOnly }),
        children: l("filter.unassigned")
      }
    ),
    /* @__PURE__ */ o(
      G,
      {
        active: e.conflictsOnly,
        count: n,
        warn: !0,
        onClick: () => t({ ...e, conflictsOnly: !e.conflictsOnly }),
        children: l("filter.conflicts")
      }
    ),
    s && /* @__PURE__ */ o(
      G,
      {
        active: e.editableOnly,
        onClick: () => t({ ...e, editableOnly: !e.editableOnly }),
        children: l("filter.editableOnly")
      }
    ),
    /* @__PURE__ */ o("span", { className: "ml-auto whitespace-nowrap rounded-[var(--radius-pill)] border border-[var(--border-subtle)] px-[var(--sp-5)] py-[var(--sp-2)] text-[length:var(--fs-caption)] text-[var(--text-tertiary)]", children: r === a ? `${a}` : `${r} / ${a}` }),
    se(e) && /* @__PURE__ */ o(
      "button",
      {
        type: "button",
        onClick: () => t(oe),
        className: "whitespace-nowrap text-[length:var(--fs-caption)] font-medium text-[var(--text-accent)] hover:text-[var(--accent-hover)]",
        children: l("filter.showAll")
      }
    )
  ] });
}
function G({
  active: e,
  count: t,
  warn: r,
  onClick: a,
  children: n
}) {
  const i = t === 0;
  return /* @__PURE__ */ m(
    Ye,
    {
      selected: e,
      onClick: a,
      disabled: i && !e,
      className: `${i && !e ? "opacity-[0.42]" : ""} ${r && e ? "!border-[var(--danger)] !bg-[var(--danger-soft)] !text-[var(--danger-text)]" : ""}`,
      children: [
        n,
        t !== void 0 && // `border-current` plutôt qu'une couleur fixe : le compteur doit se
        // détacher du libellé quel que soit l'état du Tag (actif, alerte,
        // survolé) sans dupliquer sa palette de couleurs ici.
        /* @__PURE__ */ o("span", { className: "tabular-nums rounded-full border border-current/30 px-[var(--sp-3)] text-[length:var(--fs-caption)] opacity-80", children: t })
      ]
    }
  );
}
function Rt({
  profilePath: e,
  profiles: t,
  onSelectProfile: r,
  onBrowse: a,
  onRefresh: n,
  onChanged: i
}) {
  const s = I(), l = T(), d = T(), v = T(), [c, g] = k(null), [y, h] = k([]), [f, _] = k(null), [$, S] = k(null), [w, p] = k(!1);
  q(() => {
    let u = !1;
    return (async () => {
      try {
        const A = await O.getSettings();
        u || g(A);
      } catch (A) {
        u || _(String(A));
      }
      if (e)
        try {
          const A = await O.listGameLanguages(e);
          u || h(A);
        } catch (A) {
          u || _(String(A));
        }
    })(), () => {
      u = !0;
    };
  }, [e]);
  async function x(u) {
    g(u);
    try {
      await O.setSettings(u), S(s("settings.saved")), _(null), i();
    } catch (A) {
      _(String(A));
    }
  }
  async function L() {
    if (!(!n || w)) {
      p(!0), _(null);
      try {
        await n();
      } catch (u) {
        _(String(u));
      } finally {
        p(!1);
      }
    }
  }
  if (!c)
    return /* @__PURE__ */ o("p", { className: "text-[length:var(--fs-body-sm)] text-[var(--text-tertiary)]", children: s("settings.loading") });
  const C = "min-w-0 rounded-[var(--radius-control)] border border-[var(--border-default)] bg-[var(--surface-2)] px-[var(--sp-6)] py-[var(--sp-4)] text-[length:var(--fs-body-sm)] text-[var(--text-primary)] focus:border-[var(--border-accent)] focus-visible:shadow-[var(--ring-focus)] focus:outline-none", N = e !== null && !t.some((u) => u.path === e);
  return /* @__PURE__ */ m("div", { className: "space-y-[var(--sp-6)]", children: [
    /* @__PURE__ */ m(
      P,
      {
        title: s("profile.title"),
        titleId: l,
        hint: s("profile.hint"),
        children: [
          /* @__PURE__ */ m("div", { className: "flex flex-wrap items-center gap-[var(--sp-4)]", children: [
            t.length > 0 || N ? /* @__PURE__ */ m(
              "select",
              {
                "aria-labelledby": l,
                className: `max-w-full flex-1 sm:flex-none ${C}`,
                value: e ?? "",
                onChange: (u) => r(u.target.value),
                children: [
                  N && /* @__PURE__ */ o("option", { value: e, children: s("profile.manual") }),
                  t.map((u) => /* @__PURE__ */ o("option", { value: u.path, children: et(u) }, u.path))
                ]
              }
            ) : /* @__PURE__ */ o("p", { className: "text-[length:var(--fs-body-sm)] text-[var(--text-tertiary)]", children: s("profile.none") }),
            /* @__PURE__ */ o(V, { variant: "secondary", size: "sm", onClick: a, className: "shrink-0", children: s("profile.browse") }),
            n && /* @__PURE__ */ o(
              V,
              {
                variant: "secondary",
                size: "sm",
                onClick: () => {
                  L();
                },
                disabled: w,
                className: "shrink-0",
                children: s(w ? "profile.refreshing" : "profile.rescan")
              }
            )
          ] }),
          e && /* @__PURE__ */ o("p", { className: "technical mt-[var(--sp-4)] break-all text-[var(--text-disabled)]", children: e })
        ]
      }
    ),
    /* @__PURE__ */ o(
      P,
      {
        title: s("settings.gameLanguage"),
        titleId: d,
        hint: s("settings.gameLanguageHint"),
        children: y.length === 0 ? /* @__PURE__ */ o("p", { className: "text-[length:var(--fs-body-sm)] text-[var(--text-tertiary)]", children: s("settings.noLanguages") }) : /* @__PURE__ */ o(
          "select",
          {
            "aria-labelledby": d,
            className: `w-full max-w-sm ${C}`,
            value: c.game_language,
            onChange: (u) => {
              x({ ...c, game_language: u.target.value });
            },
            children: y.map((u) => /* @__PURE__ */ o("option", { value: u.id, children: u.label }, u.id))
          }
        )
      }
    ),
    /* @__PURE__ */ m(
      P,
      {
        title: s("settings.uiLanguage"),
        titleId: v,
        hint: s("settings.uiLanguageHint"),
        children: [
          /* @__PURE__ */ o(
            "div",
            {
              className: "flex gap-[var(--sp-4)]",
              role: "group",
              "aria-labelledby": v,
              children: [
                { id: "fr", label: "Français" },
                { id: "en", label: "English" }
              ].map((u) => /* @__PURE__ */ o(
                V,
                {
                  size: "sm",
                  variant: c.ui_language === u.id ? "primary" : "secondary",
                  "aria-pressed": c.ui_language === u.id,
                  onClick: () => {
                    x({ ...c, ui_language: u.id });
                  },
                  children: u.label
                },
                u.id
              ))
            }
          ),
          /* @__PURE__ */ o("p", { className: "mt-[var(--sp-4)] text-[length:var(--fs-caption)] text-[var(--text-tertiary)]", children: s("settings.installHint") })
        ]
      }
    ),
    $ && /* @__PURE__ */ o("p", { className: "text-[length:var(--fs-body-sm)] text-[var(--success-text)]", children: $ }),
    f && /* @__PURE__ */ o("p", { className: "text-[length:var(--fs-body-sm)] text-[var(--danger-text)]", children: f })
  ] });
}
function et(e) {
  const t = tt(e.path) ?? e.path;
  return `${e.channel} — ${t}`;
}
function tt(e) {
  const t = /(?:^|[\\/])StarCitizen(?=[\\/]|$)/gi;
  let r = null, a;
  for (; (a = t.exec(e)) !== null; )
    r = a;
  return r ? e.slice(0, r.index + r[0].length) : null;
}
function P({
  title: e,
  titleId: t,
  hint: r,
  children: a
}) {
  return /* @__PURE__ */ m(Xe, { children: [
    /* @__PURE__ */ o(
      "h3",
      {
        id: t,
        className: "text-[length:var(--fs-body)] font-semibold text-[var(--text-primary)]",
        children: e
      }
    ),
    /* @__PURE__ */ o("p", { className: "mb-[var(--sp-4)] mt-[var(--sp-1)] text-[length:var(--fs-caption)] text-[var(--text-tertiary)]", children: r }),
    a
  ] });
}
export {
  Ee as AXES,
  ct as ContextRules,
  At as EditorToolbar,
  Ot as FilterBar,
  oe as NO_FILTERS,
  Rt as SettingsPanel,
  Ct as TranslationProvider,
  he as actionLabel,
  lt as activationBadge,
  Ce as activationGestureOf,
  it as activationGesturesOverlap,
  O as api,
  Me as apply,
  Oe as assessConflictPair,
  ge as bindingLabel,
  Ie as build,
  D as canonicalControlToken,
  $t as captureErrorMessage,
  Lt as capturedToken,
  ye as categoryLabel,
  Z as classifyConflictPair,
  _t as controlLabel,
  ft as controlsFor,
  Nt as describe,
  gt as devicePrefix,
  z as effectiveToken,
  ht as filters,
  yt as fromKeyPress,
  xt as fromMouse,
  kt as fromWheel,
  mt as groupLabel,
  Re as hasConflict,
  vt as hasUncertainConflict,
  ut as indexConflicts,
  Le as isAssigned,
  se as isFiltering,
  st as isKnownAction,
  E as keyOf,
  Ve as keycapLabel,
  ie as modeOf,
  bt as modifierOf,
  dt as rivalsOf,
  B as triggerSignatureKey,
  F as triggerSignatureOf,
  pt as uncertainRivalsOf,
  St as useCapture,
  wt as useKeyboardLayoutMap,
  I as useT
};
