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
  // Vraie, et vérifiable : l'arbre de dépendances ne contient aucun client
  // HTTP. L'ancienne mention promettait une sauvegarde automatique, qui
  // n'existe plus depuis que les points de restauration sont manuels.
  "app.readOnlyNotice": "Fonctionne hors ligne — aucune donnée ne sort de votre machine",

  "tab.edit": "Modifier les commandes",
  "tab.settings": "Réglages",

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
  "backup.delete": "Supprimer",
  "backup.deleted": "Point de restauration supprimé.",
  "backup.confirmDeleteTitle": "Supprimer ce point de restauration ?",
  "backup.confirmDeleteBody":
    "La suppression est définitive : ce point ne pourra plus être restauré. Votre profil de jeu, lui, n'est pas touché.",
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
  "upgrade.cta": "Découvrir SpaceMapper Premium — 15 €",
  "error.title": "Lecture impossible",

  "diag.corruptBindings": "Assignations que le jeu ne saura pas relire",
  "diag.corruptBindingsDetail":
    "Le client Star Citizen a écrit des valeurs illisibles : ces touches resteront muettes en jeu. SpaceMapper Lite vous les signale, l'édition Premium les répare.",

  "tab.diagnosis": "Périphériques",
  "diag.title": "Correspondance matériel",
  "diag.hint":
    "Ce que votre profil désigne, face à ce qui est réellement branché. Star Citizen ne montre nulle part cette correspondance.",
  "diag.liveTitle": "Branché maintenant",
  "diag.declaredTitle": "Nommé dans votre profil",
  "diag.slotsTitle": "Emplacements utilisés",
  "diag.noProfile": "Choisissez un profil pour lancer le diagnostic.",
  "diag.refresh": "Actualiser",
  "diag.rank": "Rang d'énumération",
  "diag.rankHint":
    "Le jeu numérote js1, js2… dans cet ordre. Cet ordre change quand vous rebranchez un manche ailleurs, et c'est ce qui inverse vos commandes.",
  "diag.matched": "Reconnu dans le profil",
  "diag.unmatched": "Absent du profil",
  "diag.slotBindings": "assignations",
  "diag.slotNamed": "périphérique nommé",
  "diag.slotAnonymous": "aucun périphérique nommé",
  "diag.guidProduct": "GUID de modèle",
  "diag.guidInstance": "GUID d'exemplaire",
  "diag.noFindings":
    "Rien à signaler : votre profil et votre matériel concordent.",
  "diag.findingsTitle": "Constats",

  "diag.anonymousSlots":
    "Rien, dans votre fichier, ne dit à quel manche s'adressent ces emplacements",
  "diag.anonymousSlotsDetail":
    "Star Citizen les attribue dans l'ordre où Windows énumère vos périphériques. Cet ordre n'est pas garanti d'un démarrage à l'autre : c'est la cause des commandes qui « sautent » d'un manche à l'autre.",
  "diag.ambiguousModel":
    "Deux exemplaires identiques : leur identifiant matériel est le même",
  "diag.ambiguousModelDetail":
    "Star Citizen n'enregistre que l'identifiant du modèle, pas celui de l'exemplaire. Aucun outil ne peut donc les distinguer par ce seul identifiant — c'est une limite du format de fichier, pas de SpaceMapper.",
  "diag.declaredButAbsent": "Nommé dans le profil, mais non branché",
  "diag.declaredButAbsentDetail":
    "Les assignations de ce périphérique restent dans le fichier ; elles seront muettes tant qu'il n'est pas rebranché.",
  "diag.pluggedButUnused": "Branché, mais aucune assignation ne le vise",
  "diag.moreSlotsThanDevices":
    "Votre profil vise plus d'emplacements que de manches branchés",

  "diag.wiggleHint":
    "Bougez un manche : sa ligne s'allume. C'est le seul moyen sûr de savoir lequel est js1 et lequel est js2.",
  "diag.notListening": "Écoute des périphériques inactive.",
  "diag.captureFailed": "Écoute impossible :",

  "diag.premiumTitle": "La réparation est une fonction Premium",
  "diag.premiumBody":
    "Lite constate. Premium renumérote les emplacements, réécrit les préfixes correspondants et crée un point de restauration avant d'y toucher.",
} as const;

export type Key = keyof typeof FR;

const EN: Record<Key, string> = {
  "app.readOnlyNotice": "Works offline — no data leaves your machine",

  "tab.edit": "Edit controls",
  "tab.settings": "Settings",

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
  "backup.delete": "Delete",
  "backup.deleted": "Restore point deleted.",
  "backup.confirmDeleteTitle": "Delete this restore point?",
  "backup.confirmDeleteBody":
    "Deletion is permanent: this point can no longer be restored. Your game profile itself is untouched.",
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
  "upgrade.cta": "Discover SpaceMapper Premium — €15",
  "error.title": "Cannot read this file",

  "diag.corruptBindings": "Bindings the game will not be able to read",
  "diag.corruptBindingsDetail":
    "The Star Citizen client wrote unreadable values: these keys will do nothing in game. SpaceMapper Lite reports them, the Premium edition repairs them.",

  "tab.diagnosis": "Devices",
  "diag.title": "Hardware match",
  "diag.hint":
    "What your profile names, against what is actually plugged in. Star Citizen shows this match nowhere.",
  "diag.liveTitle": "Plugged in now",
  "diag.declaredTitle": "Named in your profile",
  "diag.slotsTitle": "Slots in use",
  "diag.noProfile": "Pick a profile to run the diagnosis.",
  "diag.refresh": "Refresh",
  "diag.rank": "Enumeration rank",
  "diag.rankHint":
    "The game numbers js1, js2… in this order. The order changes when you move a stick to another port, and that is what swaps your controls.",
  "diag.matched": "Found in profile",
  "diag.unmatched": "Not in profile",
  "diag.slotBindings": "bindings",
  "diag.slotNamed": "device named",
  "diag.slotAnonymous": "no device named",
  "diag.guidProduct": "Model GUID",
  "diag.guidInstance": "Unit GUID",
  "diag.noFindings": "Nothing to report: your profile and hardware agree.",
  "diag.findingsTitle": "Findings",

  "diag.anonymousSlots":
    "Nothing in your file says which stick these slots refer to",
  "diag.anonymousSlotsDetail":
    "Star Citizen assigns them in the order Windows enumerates your devices. That order is not guaranteed from one boot to the next: this is why controls appear to jump from one stick to the other.",
  "diag.ambiguousModel": "Two identical units: their hardware id is the same",
  "diag.ambiguousModelDetail":
    "Star Citizen records only the model id, not the unit id. No tool can tell them apart from that id alone — this is a limit of the file format, not of SpaceMapper.",
  "diag.declaredButAbsent": "Named in the profile, but not plugged in",
  "diag.declaredButAbsentDetail":
    "This device's bindings stay in the file; they will do nothing until it is plugged back in.",
  "diag.pluggedButUnused": "Plugged in, but no binding targets it",
  "diag.moreSlotsThanDevices":
    "Your profile targets more slots than you have sticks plugged in",

  "diag.wiggleHint":
    "Move a stick: its row lights up. This is the only reliable way to tell which one is js1 and which is js2.",
  "diag.notListening": "Device listening is off.",
  "diag.captureFailed": "Cannot listen:",

  "diag.premiumTitle": "Repair is a Premium feature",
  "diag.premiumBody":
    "Lite reports. Premium renumbers the slots, rewrites the matching prefixes, and creates a restore point before touching anything.",
};

const TABLES: Record<Lang, Record<Key, string>> = { fr: FR, en: EN };

/** Fonction de traduction pour une langue donnée. */
export function translator(lang: Lang): (key: Key) => string {
  const table = TABLES[lang] ?? FR;
  return (key) => table[key];
}
