// Modules purs : logique partagée entre toutes les éditions.
export * from "./lib/api";
export * from "./lib/actionLabels";
export * from "./lib/conflicts";
export * from "./lib/controls";
export * from "./lib/filter";
// Egalement en objet : BindingEditor y accede en `filter.apply(...)`, forme
// plus lisible que sept imports nommes au milieu du reste.
export * as filters from "./lib/filter";
export {
  build,
  captureErrorMessage,
  describe,
  fromKeyPress,
  fromMouse,
  fromWheel,
  keycapLabel,
  modifierOf,
  useKeyboardLayoutMap,
  type CaptureError,
  type CaptureResult,
} from "./lib/keyboard";
export * from "./lib/keys";
export { TranslationProvider, useT, type Translate } from "./lib/i18nContext";
export * from "./useCapture";

// Écrans identiques d'une édition à l'autre.
export { default as EditorToolbar } from "./EditorToolbar";
export { default as FilterBar } from "./FilterBar";
export { default as SettingsPanel } from "./SettingsPanel";
