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

export interface DeviceView {
  instance_guid: string;
  product_name: string;
  instance_name: string;
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

export const api = {
  listDevices: () => invoke<DeviceView[]>("list_devices"),
  locateActionmaps: () => invoke<ProfileLocation[]>("locate_actionmaps"),
  readFlightBindings: (path: string) =>
    invoke<FlightBindings>("read_flight_bindings", { path }),
  edition: () => invoke<string>("edition"),
};
