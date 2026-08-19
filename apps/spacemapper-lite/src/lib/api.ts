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

export interface EditableBinding {
  actionmap: string;
  category: EditCategory;
  access: EditAccess;
  action: string;
  input_raw: string;
  device: string | null;
  control: string | null;
  locked: boolean;
  locked_reason: string | null;
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

export interface BackupView {
  path: string;
  /** Millisecondes depuis l'époque Unix, sous forme de chaîne. */
  timestamp: string;
}

export const api = {
  listDevices: () => invoke<DeviceView[]>("list_devices"),
  locateActionmaps: () => invoke<ProfileLocation[]>("locate_actionmaps"),
  readFlightBindings: (path: string) =>
    invoke<FlightBindings>("read_flight_bindings", { path }),
  buildInfo: () => invoke<BuildInfo>("build_info"),

  listEditableBindings: (path: string) =>
    invoke<EditableBinding[]>("list_editable_bindings", { path }),

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
   * Ouvre une session de lecture sur plusieurs périphériques à la fois.
   * Renvoie le numéro de session, à repasser à `stopCapture`.
   */
  startCapture: (guids: string[]) => invoke<number>("start_capture", { guids }),

  /** Dernier contrôle actionné, ou `null` si rien n'a été pressé. */
  pollCapture: () => invoke<CapturedInput | null>("poll_capture"),

  /** N'arrête que la session désignée : voir le commentaire côté Rust. */
  stopCapture: (id: number) => invoke<void>("stop_capture", { id }),

  restoreBackup: (path: string, backupPath: string) =>
    invoke<void>("restore_backup", { path, backupPath }),
};
