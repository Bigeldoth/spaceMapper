/**
 * Traduction de l'interface de SpaceMapper.
 *
 * Distincte de la langue des commandes, qui vient du jeu : un joueur veut
 * souvent l'application dans sa langue tout en gardant les noms de commandes
 * en anglais, qui sont ceux qu'échange la communauté.
 *
 * La communauté Star Citizen étant très majoritairement anglophone, l'anglais
 * n'est pas une commodité mais la condition d'un marché.
 */

export type Lang = "fr" | "en";

/**
 * Clés de traduction.
 *
 * Le français fait foi : c'est la langue dans laquelle les textes sont
 * pensés, et le typage impose à l'anglais de la couvrir entièrement — une
 * traduction oubliée devient une erreur de compilation plutôt qu'une chaîne
 * manquante à l'écran.
 */
const FR = {
  "app.readOnlyNotice": "Sauvegarde automatique avant chaque modification",

  "tab.overview": "Aperçu complet",
  "tab.edit": "Modifier les commandes",
  "tab.settings": "Réglages",

  "devices.title": "Périphériques détectés",
  "devices.hint":
    "Identifiés par leur GUID matériel, stable quel que soit le port USB. La liste se met à jour automatiquement au branchement.",
  "devices.empty":
    "Aucun périphérique de jeu détecté. Branchez votre manche — il apparaîtra ici en quelques secondes.",
  "devices.axes": "axes",
  "devices.buttons": "boutons",
  "devices.hats": "chapeaux",

  "profile.title": "Profil analysé",
  "profile.browse": "Choisir un fichier…",
  "profile.none": "Aucune installation détectée automatiquement.",

  "scope.title":
    "L'édition Lite couvre tout ce qu'il faut pour décoller, se déplacer et se poser. Les autres catégories sont affichées mais verrouillées.",
  "scope.defaults":
    "Les commandes marquées « défaut » viennent des réglages d'origine du jeu : elles fonctionnent sans figurer dans votre fichier, et les modifier y crée une surcharge.",
  "scope.closeGame":
    "Rien n'est écrit tant que vous n'avez pas enregistré. Fermez Star Citizen avant d'éditer : le jeu réécrit ce fichier en quittant et écraserait vos changements.",

  "probe.title": "Identifier une commande",
  "probe.idle":
    "Actionnez un bouton, un axe ou une touche : les commandes qui l'utilisent s'éclairent dans la liste.",
  "probe.noMatch": "Aucune commande de déplacement n'utilise ce contrôle.",
  "probe.listening": "à l'écoute",
  "probe.opening": "ouverture…",
  "probe.stopped": "à l'arrêt",
  "probe.clear": "Effacer",

  "filter.placeholder": "Rechercher une commande, une touche, un bouton…",
  "filter.origin": "Origine",
  "filter.origin.all": "Tout",
  "filter.origin.override": "Mes réglages",
  "filter.origin.default": "Réglages d'origine",
  "filter.device": "Appareil",
  "filter.device.all": "Tous",
  "filter.device.joystick": "Manche",
  "filter.device.keyboard": "Clavier",
  "filter.device.gamepad": "Manette",
  "filter.device.mouse": "Souris",
  "filter.editableOnly": "Modifiables seulement",
  "filter.showAll": "Tout afficher",
  "filter.noMatch":
    "Aucune commande ne correspond. Élargissez la recherche ou les filtres.",

  "binding.unassigned": "non assignée",
  "binding.default": "défaut",
  "binding.defaultTitle": "Réglage d'origine du jeu — absent de votre fichier",
  "binding.edit": "Modifier",
  "binding.clear": "Effacer",
  "binding.revert": "Rétablir",
  "binding.locked": "Verrouillé",

  "lock.dangerous_action":
    "Action irréversible — réassignation réservée à l'édition Premium",
  "lock.premium_category": "Catégorie réservée à l'édition Premium",
  "lock.has_modifier":
    "Comporte un modificateur — réservé à l'édition Premium",
  "lock.has_activation_mode":
    "Comporte un mode d'activation — réservé à l'édition Premium",

  "upsell.title": "Réservé à l'édition Premium",
  "upsell.body":
    "SpaceMapper Premium débloque toutes les catégories — combat, énergie, systèmes de bord, tourelles — ainsi que les modificateurs, les modes d'activation, les profils nommés et la synchronisation entre machines.",
  "upsell.close": "Fermer",

  "save.unsaved": "modification non enregistrée",
  "save.unsavedPlural": "modifications non enregistrées",
  "save.discardAll": "Tout annuler",
  "save.open": "Enregistrer…",
  "save.saving": "Enregistrement…",
  "save.title": "Enregistrer les modifications",
  "save.review": "Voir les modifications",
  "save.hideReview": "Masquer le détail",
  "save.remove": "Retirer",
  "save.restorePoint": "Créer un point de restauration avant d'écrire",
  "save.restorePointHint":
    "Sans lui, ces modifications ne seront pas annulables.",
  "save.confirm": "Enregistrer",
  "save.cancel": "Annuler",

  "backup.title": "Points de restauration",
  "backup.hint":
    "Copies de votre profil, conservées hors du dossier du jeu. Format XML lisible : elles restent exploitables même sans SpaceMapper.",
  "backup.create": "Sauvegarder maintenant",
  "backup.empty": "Aucun point de restauration.",
  "backup.restore": "Restaurer",
  "backup.confirmTitle": "Restaurer le profil ?",
  "backup.confirmKept":
    "L'état actuel sera conservé comme nouveau point de restauration : vous pourrez revenir en arrière.",

  "picker.keyboard": "Clavier",
  "picker.joystick": "Manche",
  "picker.gamepad": "Manette",
  "picker.pressKey": "Appuyez sur la touche ou la combinaison souhaitée.",
  "picker.keyHint":
    "Une touche modificatrice seule — Maj, Ctrl, Alt — est retenue quand vous la relâchez. La position physique de la touche est enregistrée, pas le caractère imprimé : c'est ainsi que Star Citizen raisonne.",
  "picker.pressControl": "Actionnez le bouton, l'axe ou le chapeau souhaité.",
  "picker.noDevice":
    "Aucun périphérique de ce type détecté. Branchez-le : il apparaîtra en quelques secondes, sans redémarrer l'application.",
  "picker.useList": "Choisir dans une liste à la place",
  "picker.useCapture": "Revenir à la capture",
  "picker.device": "Périphérique",
  "picker.control": "Contrôle",
  "picker.choose": "Choisir…",
  "picker.apply": "Appliquer",

  "settings.gameLanguage": "Langue des commandes",
  "settings.gameLanguageHint":
    "Les noms et descriptions viennent de Star Citizen lui-même, dans la langue choisie.",
  "settings.noLanguages":
    "Aucune langue détectée dans votre installation. Les noms de commandes de SpaceMapper seront utilisés.",
  "settings.uiLanguage": "Langue de SpaceMapper",
  "settings.uiLanguageHint":
    "Celle de cette interface, indépendante de la précédente.",
  "settings.installHint": "Ce choix sera aussi proposé à l'installation.",
  "settings.saved": "Réglages enregistrés.",
  "settings.loading": "Chargement des réglages…",

  "defaults.unavailable": "Valeurs par défaut du jeu indisponibles",
  "defaults.unavailableHint":
    "Seules vos modifications enregistrées sont affichées. Une configuration qui fonctionne repose en grande partie sur les réglages d'origine, absents de votre fichier.",

  "staging.banner": "Pré-release",
  "loading": "Détection en cours…",
} as const;

export type Key = keyof typeof FR;

const EN: Record<Key, string> = {
  "app.readOnlyNotice": "Automatic backup before every change",

  "tab.overview": "Full overview",
  "tab.edit": "Edit controls",
  "tab.settings": "Settings",

  "devices.title": "Detected devices",
  "devices.hint":
    "Identified by hardware GUID, stable across USB ports. The list refreshes automatically when you plug a device in.",
  "devices.empty":
    "No game controller detected. Plug in your stick — it will appear here within seconds.",
  "devices.axes": "axes",
  "devices.buttons": "buttons",
  "devices.hats": "hats",

  "profile.title": "Profile in use",
  "profile.browse": "Choose a file…",
  "profile.none": "No installation detected automatically.",

  "scope.title":
    "The Lite edition covers everything needed to take off, fly and land. Other categories are shown but locked.",
  "scope.defaults":
    "Controls marked “default” come from the game's own settings: they work without appearing in your file, and changing one writes an override.",
  "scope.closeGame":
    "Nothing is written until you save. Close Star Citizen before editing: the game rewrites this file on exit and would discard your changes.",

  "probe.title": "Identify a control",
  "probe.idle":
    "Press a button, move an axis or hit a key: the commands using it light up in the list.",
  "probe.noMatch": "No movement command uses this control.",
  "probe.listening": "listening",
  "probe.opening": "opening…",
  "probe.stopped": "stopped",
  "probe.clear": "Clear",

  "filter.placeholder": "Search a command, a key, a button…",
  "filter.origin": "Origin",
  "filter.origin.all": "All",
  "filter.origin.override": "My settings",
  "filter.origin.default": "Game defaults",
  "filter.device": "Device",
  "filter.device.all": "All",
  "filter.device.joystick": "Stick",
  "filter.device.keyboard": "Keyboard",
  "filter.device.gamepad": "Gamepad",
  "filter.device.mouse": "Mouse",
  "filter.editableOnly": "Editable only",
  "filter.showAll": "Show all",
  "filter.noMatch": "No command matches. Widen the search or the filters.",

  "binding.unassigned": "unassigned",
  "binding.default": "default",
  "binding.defaultTitle": "Game default — not present in your file",
  "binding.edit": "Change",
  "binding.clear": "Clear",
  "binding.revert": "Revert",
  "binding.locked": "Locked",

  "lock.dangerous_action":
    "Irreversible action — reassignment reserved for the Premium edition",
  "lock.premium_category": "Category reserved for the Premium edition",
  "lock.has_modifier":
    "Uses a modifier — reserved for the Premium edition",
  "lock.has_activation_mode":
    "Uses an activation mode — reserved for the Premium edition",

  "upsell.title": "Reserved for the Premium edition",
  "upsell.body":
    "SpaceMapper Premium unlocks every category — combat, power, ship systems, turrets — along with modifiers, activation modes, named profiles and sync across machines.",
  "upsell.close": "Close",

  "save.unsaved": "unsaved change",
  "save.unsavedPlural": "unsaved changes",
  "save.discardAll": "Discard all",
  "save.open": "Save…",
  "save.saving": "Saving…",
  "save.title": "Save changes",
  "save.review": "Review changes",
  "save.hideReview": "Hide details",
  "save.remove": "Remove",
  "save.restorePoint": "Create a restore point before writing",
  "save.restorePointHint": "Without one, these changes cannot be undone.",
  "save.confirm": "Save",
  "save.cancel": "Cancel",

  "backup.title": "Restore points",
  "backup.hint":
    "Copies of your profile, kept outside the game folder. Plain XML: still usable even without SpaceMapper.",
  "backup.create": "Back up now",
  "backup.empty": "No restore point.",
  "backup.restore": "Restore",
  "backup.confirmTitle": "Restore this profile?",
  "backup.confirmKept":
    "The current state will be kept as a new restore point: you can go back.",

  "picker.keyboard": "Keyboard",
  "picker.joystick": "Stick",
  "picker.gamepad": "Gamepad",
  "picker.pressKey": "Press the key or combination you want.",
  "picker.keyHint":
    "A lone modifier — Shift, Ctrl, Alt — is captured when you release it. The physical key position is recorded, not the printed character: that is how Star Citizen works.",
  "picker.pressControl": "Press the button, axis or hat you want.",
  "picker.noDevice":
    "No device of this kind detected. Plug it in: it will appear within seconds, without restarting the application.",
  "picker.useList": "Pick from a list instead",
  "picker.useCapture": "Back to capture",
  "picker.device": "Device",
  "picker.control": "Control",
  "picker.choose": "Choose…",
  "picker.apply": "Apply",

  "settings.gameLanguage": "Control names language",
  "settings.gameLanguageHint":
    "Names and descriptions come from Star Citizen itself, in the chosen language.",
  "settings.noLanguages":
    "No language detected in your installation. SpaceMapper's own control names will be used.",
  "settings.uiLanguage": "SpaceMapper language",
  "settings.uiLanguageHint":
    "The language of this interface, independent of the one above.",
  "settings.installHint": "This choice will also be offered during install.",
  "settings.saved": "Settings saved.",
  "settings.loading": "Loading settings…",

  "defaults.unavailable": "Game defaults unavailable",
  "defaults.unavailableHint":
    "Only your saved changes are shown. A working configuration relies largely on the game's own settings, which are absent from your file.",

  "staging.banner": "Pre-release",
  "loading": "Detecting…",
};

const TABLES: Record<Lang, Record<Key, string>> = { fr: FR, en: EN };

/** Fonction de traduction pour une langue donnée. */
export function translator(lang: Lang): (key: Key) => string {
  const table = TABLES[lang] ?? FR;
  return (key) => table[key];
}
