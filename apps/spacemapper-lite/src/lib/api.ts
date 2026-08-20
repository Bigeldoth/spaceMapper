/**
 * Frontière unique entre React et Rust.
 *
 * Les composants n'appellent jamais `invoke` directement : tout passe par ici,
 * pour qu'il n'existe qu'un seul endroit à modifier quand le contrat Rust
 * évolue, et un seul endroit à lire pour savoir ce que l'application peut
 * réellement faire.
 *
 * Ces types reflètent les structures `Serialize` de `commands.rs`.
 */
import { invoke } from "@tauri-apps/api/core";

/** Détermine le préfixe employé par le jeu : `js` ou `gp`. */
export type DeviceCategory = "joystick" | "gamepad";

export interface DeviceView {
  instance_guid: string;
  product_name: string;
  instance_name: string;
  category: DeviceCategory;
  axes: number;
  buttons: number;
  povs: number;
}

export interface ProfileLocation {
  channel: string;
  path: string;
}

export interface BindingView {
  category: string;
  action: string;
  input_raw: string;
  device: string | null;
  modifier: string | null;
  control: string | null;
  activation_mode: string | null;
  multi_tap: string | null;
  corrupt: boolean;
  line: number;
}

export interface FlightBindings {
  profile_name: string | null;
  joysticks_in_use: number[];
  known_guids: string[];
  bindings: BindingView[];
  corrupt_count: number;
}

export interface BuildInfo {
  edition: string;
  channel: string;
  version: string;
}

export type EditCategory = "flight" | "on_foot";

/** `premium_only` n'est jamais renvoyé à Lite : ces catégories sont filtrées. */
export type EditAccess = "lite" | "premium_teaser" | "premium_only";

/**
 * D'où vient une assignation.
 *
 * `game_default` provient de `Data.p4k` et n'existe pas dans le fichier du
 * joueur : c'est la majorité d'une configuration qui fonctionne.
 */
export type Origin = "override" | "game_default";

export interface EditableBinding {
  actionmap: string;
  category: EditCategory;
  access: EditAccess;
  origin: Origin;
  action: string;
  /** Libellé fourni par le jeu, dans la langue choisie. */
  label: string | null;
  /** Description fournie par le jeu. Souvent vide hors anglais. */
  description: string | null;
  input_raw: string;
  device: string | null;
  /** Touche modificatrice, ex. `lshift` dans `kb1_lshift+f`. */
  modifier: string | null;
  control: string | null;
  /** Motif du verrouillage, ou `null` si l'assignation est modifiable. */
  lock: LockReason | null;
}

/**
 * Pourquoi une assignation ne peut pas être modifiée ici.
 *
 * Un code plutôt qu'une phrase : le texte dépend de la langue de l'interface,
 * que le backend ne connaît pas.
 */
export type LockReason =
  | "dangerous_action"
  | "premium_category"
  | "has_modifier"
  | "has_activation_mode";

export interface MergedBindings {
  bindings: EditableBinding[];
  /** Motif d'indisponibilité des valeurs par défaut, le cas échéant. */
  defaults_error: string | null;
}

/** Une modification en attente d'enregistrement. `input: null` efface. */
export interface PendingEdit {
  actionmap: string;
  action: string;
  input: string | null;
}

/** Contrôle relevé par la session de capture, et périphérique d'origine. */
export interface CapturedInput {
  /** GUID du périphérique effectivement actionné. */
  guid: string;
  /** Ex. `button5`, `hat1_up`, `rotz`. */
  control: string;
}

/**
 * Nature d'un GUID DirectInput.
 *
 * `product` est dérivé du couple VID/PID : deux exemplaires d'un même modèle
 * le partagent. C'est celui que Star Citizen écrit.
 */
export type GuidKind = "product" | "instance" | "other";

export interface LiveDevice {
  product_name: string;
  instance_name: string;
  product_guid: string;
  instance_guid: string;
  category: DeviceCategory;
  axes: number;
  buttons: number;
  povs: number;
  /** Rang dans l'énumération, par famille, à partir de 1. */
  rank: number;
  declared_in_file: boolean;
}

export interface DeclaredDevice {
  name: string;
  guid: string | null;
  guid_kind: GuidKind | null;
  /** Nombre de périphériques branchés partageant ce GUID produit. */
  matching_devices: number;
}

export interface SlotUsage {
  instance: number;
  bindings: number;
  /** Le bloc `<options>` de ce slot nomme-t-il un périphérique ? */
  named: boolean;
}

/** Un constat du diagnostic. Le discriminant est `kind`. */
export type Finding =
  | { kind: "anonymous_slots"; instances: number[] }
  | { kind: "ambiguous_model"; product_name: string; count: number }
  | { kind: "declared_but_absent"; name: string }
  | { kind: "plugged_but_unused"; name: string }
  | { kind: "more_slots_than_devices"; slots: number; devices: number }
  | { kind: "corrupt_bindings"; count: number };

export interface Diagnosis {
  live: LiveDevice[];
  declared: DeclaredDevice[];
  slots: SlotUsage[];
  findings: Finding[];
}

export interface BackupView {
  path: string;
  /** Millisecondes depuis l'époque Unix, sous forme de chaîne. */
  timestamp: string;
}

/** Une langue disponible dans l'installation du joueur. */
export interface Language {
  /** Identifiant employé par l'archive, ex. `french_(france)`. */
  id: string;
  label: string;
}

export interface Settings {
  /** Langue des libellés issus du jeu. */
  game_language: string;
  /** Langue de l'interface de SpaceMapper : `fr` ou `en`. */
  ui_language: string;
  version: number;
}

export const api = {
  listDevices: () => invoke<DeviceView[]>("list_devices"),
  locateActionmaps: () => invoke<ProfileLocation[]>("locate_actionmaps"),
  readFlightBindings: (path: string) =>
    invoke<FlightBindings>("read_flight_bindings", { path }),
  buildInfo: () => invoke<BuildInfo>("build_info"),

  /** Confronte le profil au matériel branché. */
  diagnoseDevices: (path: string) =>
    invoke<Diagnosis>("diagnose_devices", { path }),

  /** Surcharges du joueur fusionnées avec les valeurs par défaut du jeu. */
  listEditableBindings: (path: string) =>
    invoke<MergedBindings>("list_editable_bindings", { path }),

  /**
   * Écrit un lot de modifications en une seule fois.
   * Renvoie le chemin du point de restauration créé, ou `null`.
   */
  saveBindings: (
    path: string,
    edits: PendingEdit[],
    createRestorePoint: boolean,
  ) =>
    invoke<string | null>("save_bindings", {
      path,
      edits,
      createRestorePoint,
    }),

  /** Crée un point de restauration ; renvoie le chemin du fichier créé. */
  createBackup: (path: string) => invoke<string>("create_backup", { path }),

  listBackups: () => invoke<BackupView[]>("list_backups"),

  /**
   * Supprime définitivement un point de restauration.
   *
   * Le backend refuse toute cible qui n'est pas une sauvegarde de SpaceMapper :
   * il détermine lui-même le dossier autorisé et ne se fie pas à ce chemin.
   */
  deleteBackup: (backupPath: string) =>
    invoke<void>("delete_backup", { backupPath }),

  /** Langues réellement présentes dans l'installation du joueur. */
  listGameLanguages: (path: string) =>
    invoke<Language[]>("list_game_languages", { path }),

  getSettings: () => invoke<Settings>("get_settings"),
  setSettings: (settings: Settings) =>
    invoke<void>("set_settings", { settings }),

  /**
   * Ouvre une session de lecture sur plusieurs périphériques à la fois.
   * Renvoie le numéro de session, à repasser à `stopCapture`.
   */
  startCapture: (guids: string[]) => invoke<number>("start_capture", { guids }),

  /** Dernier contrôle actionné, ou `null` si rien n'a été pressé. */
  pollCapture: () => invoke<CapturedInput | null>("poll_capture"),

  /** Oublie le dernier relevé sans fermer la session. */
  clearCapture: () => invoke<void>("clear_capture"),

  /** N'arrête que la session désignée : voir le commentaire côté Rust. */
  stopCapture: (id: number) => invoke<void>("stop_capture", { id }),

  restoreBackup: (path: string, backupPath: string) =>
    invoke<void>("restore_backup", { path, backupPath }),
};
