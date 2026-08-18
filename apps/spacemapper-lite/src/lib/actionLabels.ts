/**
 * Traduction des noms internes en libellés lisibles.
 *
 * C'est le premier argument du produit : `v_toggle_qdrive_engagement` ne dit
 * rien à personne, « Enclencher le saut quantique » se comprend d'un coup
 * d'œil. Le jeu n'expose ces noms nulle part de façon compréhensible.
 *
 * Ce catalogue est volontairement partiel — il couvre les actions de vol
 * courantes. La Phase 3 le régénérera automatiquement depuis `Data.p4k`, ce
 * qui garantira l'exhaustivité à chaque patch. En attendant, une action
 * inconnue s'affiche sous son nom brut plutôt que d'être masquée.
 */

const LABELS: Record<string, string> = {
  // Déplacement
  v_pitch: "Tangage",
  v_yaw: "Lacet",
  v_roll: "Roulis",
  v_strafe_vertical: "Translation verticale",
  v_strafe_lateral: "Translation latérale",
  v_strafe_longitudinal: "Translation avant/arrière",
  v_boost: "Boost",
  v_atc_request: "Demander l'autorisation d'atterrir",
  v_brake: "Frein spatial",
  v_speed_range_up: "Augmenter la vitesse limite",
  v_speed_range_down: "Réduire la vitesse limite",
  v_toggle_landing_system: "Train d'atterrissage",
  v_toggle_vtol: "Basculer en VTOL",
  v_autoland: "Atterrissage automatique",
  v_lights: "Feux du vaisseau",

  // Modes maîtres
  v_toggle_master_mode: "Basculer SCM / NAV",
  v_toggle_quantum_mode: "Mode quantique",
  v_toggle_qdrive_engagement: "Enclencher le saut quantique",
  v_toggle_scan_mode: "Mode scan",
  v_toggle_mining_mode: "Mode minage",
  v_toggle_salvage_mode: "Mode récupération",

  // Armement
  v_attack1_group1: "Tir — groupe 1",
  v_attack1_group2: "Tir — groupe 2",
  v_weapon_toggle_launch_missile: "Lancer un missile",
  v_weapon_cycle_missile_fwd: "Missile suivant",
  v_target_cycle_hostile_fwd: "Cible hostile suivante",
  v_target_cycle_all_fwd: "Cible suivante",
  v_target_toggle_pin_index_1: "Épingler la cible 1",
  v_target_unlock_selected: "Déverrouiller la cible",
  v_toggle_gimbalmode: "Mode gimbal",

  // Défense et survie
  v_weapon_countermeasure_decoy_launch: "Larguer un leurre",
  v_weapon_countermeasure_noise_launch: "Brouillage (chaff)",
  v_shield_raise_level_forward: "Renforcer le bouclier avant",
  v_shield_raise_level_back: "Renforcer le bouclier arrière",
  v_shield_reset_level: "Réinitialiser les boucliers",
  v_power_focus_weapons: "Énergie → armes",
  v_power_focus_shields: "Énergie → boucliers",
  v_power_focus_thrusters: "Énergie → moteurs",
  v_power_reset_focus: "Réinitialiser l'énergie",
  v_eject: "Éjection",
  v_self_destruct: "Autodestruction",

  // Systèmes et vue
  v_view_mode: "Changer de vue",
  v_view_freelook_mode: "Vue libre",
  v_toggle_mining_laser_type: "Type de laser de minage",
  v_toggle_tractor_beam: "Rayon tracteur",
  v_enter_remote_turret_1: "Entrer en tourelle 1",
  v_enter_remote_turret_2: "Entrer en tourelle 2",
};

/** Libellé lisible, ou le nom brut si l'action n'est pas encore cataloguée. */
export function actionLabel(name: string): string {
  return LABELS[name] ?? name;
}

/** L'action est-elle cataloguée ? Sert à nuancer l'affichage. */
export function isKnownAction(name: string): boolean {
  return name in LABELS;
}

const CATEGORY_LABELS: Record<string, string> = {
  seat_general: "Siège & systèmes",
  spaceship_general: "Vaisseau — général",
  spaceship_movement: "Pilotage",
  spaceship_view: "Vue",
  spaceship_targeting: "Ciblage",
  spaceship_target_hailing: "Communication",
  spaceship_weapons: "Armement",
  spaceship_missiles: "Missiles",
  spaceship_defensive: "Contre-mesures",
  spaceship_power: "Énergie",
  spaceship_shield: "Boucliers",
  spaceship_radar: "Radar",
  spaceship_scanning: "Scan",
  spaceship_mining: "Minage",
  spaceship_salvage: "Récupération",
  spaceship_quantum: "Saut quantique",
  spaceship_docking: "Amarrage",
  spaceship_hud: "Interface (HUD)",
  spaceship_turret: "Tourelles",
  spaceship_auto_weapons: "Armes automatiques",
  vehicle_general: "Véhicule terrestre",
  vehicle_driver: "Conduite",
};

export function categoryLabel(name: string): string {
  return CATEGORY_LABELS[name] ?? name;
}
