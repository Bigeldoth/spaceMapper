/**
 * Clés de traduction dont les écrans partagés ont besoin.
 *
 * Les tables de traduction restent propres à chaque édition — leurs textes
 * diffèrent, et c'est voulu. Mais les écrans partagés, eux, réclament un
 * vocabulaire précis : cette union le nomme.
 *
 * Chaque application déclare `const _: Record<CoreKey, string> = FR;` dans son
 * `i18n.ts`. Une clé oubliée devient alors une erreur de compilation, comme
 * l'était déjà une traduction anglaise manquante — plutôt qu'un libellé vide
 * découvert à l'écran.
 */
export type CoreKey =
  // EditorToolbar — modes de pilotage, sonde, sauvegardes, périmètre
  | "filter.mode"
  | "filter.mode.all"
  | "filter.mode.desk"
  | "filter.mode.gamepad"
  | "filter.mode.joystick"
  | "probe.idle"
  | "probe.noMatch"
  | "probe.matchOne"
  | "probe.matchMany"
  | "probe.deviceOne"
  | "probe.deviceMany"
  | "probe.stopped"
  | "probe.clear"
  | "backup.title"
  | "backup.hint"
  | "backup.create"
  | "backup.created"
  | "backup.empty"
  | "backup.restore"
  | "backup.delete"
  | "backup.confirmTitle"
  | "backup.confirmKept"
  | "backup.confirmDeleteTitle"
  | "backup.confirmDeleteBody"
  | "save.cancel"
  | "scope.title"
  | "scope.editable"
  | "scope.defaults"
  | "scope.closeGame"
  // FilterBar
  | "filter.placeholder"
  | "filter.unassigned"
  | "filter.conflicts"
  | "filter.editableOnly"
  | "filter.showAll"
  // SettingsPanel
  | "settings.loading"
  | "settings.saved"
  | "settings.gameLanguage"
  | "settings.gameLanguageHint"
  | "settings.noLanguages"
  | "settings.uiLanguage"
  | "settings.uiLanguageHint"
  | "settings.installHint"
  | "profile.title"
  | "profile.hint"
  | "profile.browse"
  | "profile.none";
