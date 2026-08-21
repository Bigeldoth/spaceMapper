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

import type { CoreKey } from "@spacemapper/app-core";

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
  "tab.edit": "Commandes",
  "tab.layouts": "Profils partagés",
  "tab.settings": "Réglages",

  "devices.empty":
    "Aucun périphérique de jeu détecté. Branchez votre manche — il apparaîtra ici en quelques secondes.",
  "devices.axes": "axes",
  "devices.buttons": "boutons",
  "devices.hats": "chapeaux",

  "profile.title": "Profil analysé",
  "profile.hint":
    "Le fichier de Star Citizen que SpaceMapper lit et modifie. Détecté automatiquement dans la plupart des cas.",
  "profile.browse": "Choisir un fichier…",
  "profile.none": "Aucune installation détectée automatiquement.",
  "profile.goToSettings": "Choisir un profil",

  "layout.title": "Profils partagés",
  "layout.hint":
    "Les dispositions exportées, celles que s'échange la communauté. Star Citizen sait les charger mais n'en montre rien avant : voici ce qu'elles contiennent et si elles correspondent à votre matériel.",
  "layout.empty":
    "Aucun profil exporté trouvé. Ils se rangent dans le dossier Controls\\mappings de votre installation.",
  "layout.noProfile": "Choisissez d'abord un profil dans les Réglages.",
  "layout.pick": "Sélectionnez un profil pour l'examiner.",
  "layout.bindings": "assignations",
  "layout.categories": "Catégories",
  "layout.advanced": "avancées",
  "layout.corrupt": "illisibles",
  "layout.expects": "Matériel attendu",
  "layout.expectsHint":
    "Le profil désigne ses périphériques par modèle. Deux manches identiques partagent le même identifiant : rien n'y dit lequel l'auteur tenait de la main droite.",
  "layout.unnamedDevice": "périphérique sans nom",
  "layout.devicePresent": "branché",
  "layout.deviceMissing": "absent",
  "layout.deviceAmbiguous": "indiscernables",
  "layout.premiumTitle": "Ce profil dépasse le périmètre de l'édition Lite",
  "layout.premiumBody":
    "Une partie de ses assignations emploie des mécanismes que Lite affiche mais ne modifie pas.",
  "layout.withModifier": "avec une touche modificatrice",
  "layout.withActivation": "avec un mode d'activation",
  "layout.withMultiTap": "avec un multi-appui",

  // Titre court : l'info-bulle a besoin d'un en-tête, pas d'un paragraphe.
  "scope.title": "Ce que l'édition Lite peut modifier",
  "scope.editable":
    "L'édition Lite couvre tout ce qu'il faut pour décoller, se déplacer et se poser. Les autres catégories sont affichées mais verrouillées.",
  "scope.defaults":
    "Les commandes marquées « défaut » viennent des réglages d'origine du jeu : elles fonctionnent sans figurer dans votre fichier, et les modifier y crée une surcharge.",
  "scope.closeGame":
    "Rien n'est écrit tant que vous n'avez pas enregistré. Fermez Star Citizen avant d'éditer : le jeu réécrit ce fichier en quittant et écraserait vos changements.",

  "probe.idle":
    "Actionnez un bouton, un axe ou une touche : les commandes qui l'utilisent s'éclairent dans la liste.",
  "probe.noMatch": "Aucune commande de déplacement n'utilise ce contrôle.",
  // Complètent un nombre affiché juste avant : « 3 commandes utilisent… ».
  "probe.matchOne": "commande utilise ce contrôle.",
  "probe.matchMany": "commandes utilisent ce contrôle.",
  "probe.deviceOne": "périphérique",
  "probe.deviceMany": "périphériques",
  "probe.listening": "à l'écoute",
  "probe.opening": "ouverture…",
  "probe.stopped": "à l'arrêt",
  "probe.clear": "Effacer",

  "filter.placeholder": "Rechercher une commande, une touche, un bouton…",
  "filter.unassigned": "Non assignées",
  "filter.conflicts": "Conflits",
  "filter.mode": "Pilotage",
  "filter.mode.all": "Tous",
  "filter.mode.desk": "Clavier + souris",
  "filter.mode.gamepad": "Manette",
  "filter.mode.joystick": "Joystick",
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
  "backup.created": "Point de restauration créé.",
  "backup.confirmDeleteTitle": "Supprimer ce point de restauration ?",
  "backup.confirmDeleteBody":
    "La suppression est définitive : ce point ne pourra plus être restauré. Votre profil de jeu, lui, n'est pas touché.",
  "backup.confirmTitle": "Restaurer le profil ?",
  "backup.confirmKept":
    "L'état actuel sera conservé comme nouveau point de restauration : vous pourrez revenir en arrière.",

  "picker.keyboard": "Clavier + souris",
  "picker.joystick": "Joystick",
  "picker.gamepad": "Manette",
  "picker.pressKey":
    "Appuyez sur la touche ou la combinaison souhaitée, ou cliquez ici avec le bouton de souris à assigner.",
  "picker.keyHint":
    "Une touche modificatrice seule — Maj, Ctrl, Alt — est retenue quand vous la relâchez. La position physique de la touche est enregistrée, pas le caractère imprimé : c'est ainsi que Star Citizen raisonne. La molette et les clics se capturent dans le cadre ci-dessus uniquement, pour que les boutons du dialogue restent utilisables.",
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

  // Noms de touches et de contrôles. Ils vivaient en dur dans `keyboard.ts` et
  // `controls.ts`, qui ne connaissent pas la langue de l'interface : le
  // sélecteur restait en français même en anglais.
  "key.lshift": "Maj gauche",
  "key.rshift": "Maj droite",
  "key.lctrl": "Ctrl gauche",
  "key.rctrl": "Ctrl droit",
  "key.lalt": "Alt gauche",
  "key.ralt": "Alt Gr",
  "key.space": "Espace",
  "key.enter": "Entrée",
  "key.escape": "Échap",
  "key.tab": "Tab",
  "key.backspace": "Retour arrière",
  "key.capslock": "Verr. Maj",
  "key.up": "Flèche haut",
  "key.down": "Flèche bas",
  "key.left": "Flèche gauche",
  "key.right": "Flèche droite",
  "key.insert": "Inser",
  "key.delete": "Suppr",
  "key.home": "Origine",
  "key.end": "Fin",
  "key.pgup": "Page préc.",
  "key.pgdn": "Page suiv.",
  "key.numpad": "Pavé num.",
  "key.mouse1": "Clic gauche",
  "key.mouse2": "Clic droit",
  "key.mouse3": "Clic molette",
  "key.mouse4": "Bouton latéral 1",
  "key.mouse5": "Bouton latéral 2",
  "key.mwheelUp": "Molette haut",
  "key.mwheelDown": "Molette bas",

  "control.buttons": "Boutons",
  "control.axes": "Axes",
  "control.hats": "Chapeaux",
  "control.button": "Bouton",
  "control.axis": "Axe",
  "control.hat": "Chapeau",
  "control.slider": "Curseur",
  "control.up": "haut",
  "control.down": "bas",
  "control.left": "gauche",
  "control.right": "droite",

  "capture.tooManyModifiers":
    "Star Citizen n'accepte qu'un seul modificateur par raccourci.",
  "capture.unsupported": "Touche non reconnue. Choisissez-en une autre.",

  "staging.banner": "Pré-release",
  "staging.isolated":
    "données isolées dans %APPDATA%\\SpaceMapper-Staging",
  "loading": "Détection en cours…",
  // Sans prix : il n'est pas arrêté, et une tarification affichée dans une
  // version déjà distribuée est difficile à reprendre.
  "upgrade.cta": "Découvrir SpaceMapper Premium",
  "error.title": "Lecture impossible",

  "detail.empty": "Sélectionnez une commande pour voir son détail.",
  "detail.assignment": "Assignation",
  "detail.activeIn": "Active :",
  "conflict.badge": "Ce contrôle est partagé avec une autre commande active en même temps",
  "conflict.oneBody": "autre commande répond au même contrôle en même temps",
  "conflict.manyBody": "autres commandes répondent au même contrôle en même temps",

  // Situations de jeu. Deux commandes ne se disputent un bouton que si elles
  // peuvent répondre ensemble : on ne marche pas en pilotant.
  "context.on_foot": "à pied",
  "context.ship_seat": "aux commandes",
  "context.ship_scanning": "en mode scan",
  "context.ship_mining": "en mode minage",
  "context.ship_salvage": "en mode récupération",
  "context.turret": "en tourelle",
  "context.eva": "en apesanteur",
  "context.ground_vehicle": "au volant",
  "context.always": "en toute situation",
  "context.out_of_game": "hors jeu",

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
  "diag.rankHint":
    "Le jeu numérote js1, js2… dans cet ordre. Cet ordre change quand vous rebranchez un manche ailleurs, et c'est ce qui inverse vos commandes.",
  "diag.matched": "Reconnu dans le profil",
  "diag.unmatched": "Absent du profil",
  "diag.slotBindings": "assignations",
  "diag.slotNamed": "périphérique nommé",
  "diag.slotAnonymous": "aucun périphérique nommé",
  "diag.guidProduct": "GUID de modèle",
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
  "tab.edit": "Controls",
  "tab.layouts": "Shared profiles",
  "tab.settings": "Settings",

  "devices.empty":
    "No game controller detected. Plug in your stick — it will appear here within seconds.",
  "devices.axes": "axes",
  "devices.buttons": "buttons",
  "devices.hats": "hats",

  "profile.title": "Profile in use",
  "profile.hint":
    "The Star Citizen file SpaceMapper reads and edits. Detected automatically in most cases.",
  "profile.browse": "Choose a file…",
  "profile.none": "No installation detected automatically.",
  "profile.goToSettings": "Choose a profile",

  "layout.title": "Shared profiles",
  "layout.hint":
    "Exported layouts, the ones the community trades. Star Citizen can load them but shows nothing beforehand: here is what they contain and whether they match your hardware.",
  "layout.empty":
    "No exported profile found. They live in the Controls\\mappings folder of your installation.",
  "layout.noProfile": "Pick a profile in Settings first.",
  "layout.pick": "Select a profile to inspect it.",
  "layout.bindings": "bindings",
  "layout.categories": "Categories",
  "layout.advanced": "advanced",
  "layout.corrupt": "unreadable",
  "layout.expects": "Expected hardware",
  "layout.expectsHint":
    "The profile names its devices by model. Two identical sticks share the same id: nothing in it says which one the author held in their right hand.",
  "layout.unnamedDevice": "unnamed device",
  "layout.devicePresent": "plugged in",
  "layout.deviceMissing": "missing",
  "layout.deviceAmbiguous": "indistinguishable",
  "layout.premiumTitle": "This profile goes beyond the Lite edition",
  "layout.premiumBody":
    "Some of its bindings use mechanisms Lite displays but does not edit.",
  "layout.withModifier": "with a modifier key",
  "layout.withActivation": "with an activation mode",
  "layout.withMultiTap": "with a multi-tap",

  "scope.title": "What the Lite edition can change",
  "scope.editable":
    "The Lite edition covers everything needed to take off, fly and land. Other categories are shown but locked.",
  "scope.defaults":
    "Controls marked “default” come from the game's own settings: they work without appearing in your file, and changing one writes an override.",
  "scope.closeGame":
    "Nothing is written until you save. Close Star Citizen before editing: the game rewrites this file on exit and would discard your changes.",

  "probe.idle":
    "Press a button, move an axis or hit a key: the commands using it light up in the list.",
  "probe.noMatch": "No movement command uses this control.",
  "probe.matchOne": "command uses this control.",
  "probe.matchMany": "commands use this control.",
  "probe.deviceOne": "device",
  "probe.deviceMany": "devices",
  "probe.listening": "listening",
  "probe.opening": "opening…",
  "probe.stopped": "stopped",
  "probe.clear": "Clear",

  "filter.placeholder": "Search a command, a key, a button…",
  "filter.unassigned": "Unassigned",
  "filter.conflicts": "Conflicts",
  "filter.mode": "Control",
  "filter.mode.all": "All",
  "filter.mode.desk": "Keyboard + mouse",
  "filter.mode.gamepad": "Gamepad",
  "filter.mode.joystick": "Joystick",
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
  "backup.created": "Restore point created.",
  "backup.confirmDeleteTitle": "Delete this restore point?",
  "backup.confirmDeleteBody":
    "Deletion is permanent: this point can no longer be restored. Your game profile itself is untouched.",
  "backup.confirmTitle": "Restore this profile?",
  "backup.confirmKept":
    "The current state will be kept as a new restore point: you can go back.",

  "picker.keyboard": "Keyboard + mouse",
  "picker.joystick": "Joystick",
  "picker.gamepad": "Gamepad",
  "picker.pressKey":
    "Press the key or combination you want, or click here with the mouse button to assign.",
  "picker.keyHint":
    "A lone modifier — Shift, Ctrl, Alt — is captured when you release it. The physical key position is recorded, not the printed character: that is how Star Citizen works. Clicks and the wheel are captured inside the frame above only, so the dialog buttons stay usable.",
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

  "key.lshift": "Left Shift",
  "key.rshift": "Right Shift",
  "key.lctrl": "Left Ctrl",
  "key.rctrl": "Right Ctrl",
  "key.lalt": "Left Alt",
  "key.ralt": "Right Alt",
  "key.space": "Space",
  "key.enter": "Enter",
  "key.escape": "Esc",
  "key.tab": "Tab",
  "key.backspace": "Backspace",
  "key.capslock": "Caps Lock",
  "key.up": "Arrow up",
  "key.down": "Arrow down",
  "key.left": "Arrow left",
  "key.right": "Arrow right",
  "key.insert": "Insert",
  "key.delete": "Delete",
  "key.home": "Home",
  "key.end": "End",
  "key.pgup": "Page Up",
  "key.pgdn": "Page Down",
  "key.numpad": "Numpad",
  "key.mouse1": "Left click",
  "key.mouse2": "Right click",
  "key.mouse3": "Middle click",
  "key.mouse4": "Side button 1",
  "key.mouse5": "Side button 2",
  "key.mwheelUp": "Wheel up",
  "key.mwheelDown": "Wheel down",

  "control.buttons": "Buttons",
  "control.axes": "Axes",
  "control.hats": "Hats",
  "control.button": "Button",
  "control.axis": "Axis",
  "control.hat": "Hat",
  "control.slider": "Slider",
  "control.up": "up",
  "control.down": "down",
  "control.left": "left",
  "control.right": "right",

  "capture.tooManyModifiers":
    "Star Citizen accepts only one modifier per binding.",
  "capture.unsupported": "Key not recognised. Please choose another one.",

  "staging.banner": "Pre-release",
  "staging.isolated": "data isolated in %APPDATA%\\SpaceMapper-Staging",
  "loading": "Detecting…",
  "upgrade.cta": "Discover SpaceMapper Premium",
  "error.title": "Cannot read this file",

  "detail.empty": "Select a command to see its details.",
  "detail.assignment": "Assignment",
  "detail.activeIn": "Active:",
  "conflict.badge":
    "This control is shared with another command active at the same time",
  "conflict.oneBody": "other command answers the same control at the same time",
  "conflict.manyBody":
    "other commands answer the same control at the same time",

  "context.on_foot": "on foot",
  "context.ship_seat": "at the controls",
  "context.ship_scanning": "in scan mode",
  "context.ship_mining": "in mining mode",
  "context.ship_salvage": "in salvage mode",
  "context.turret": "in a turret",
  "context.eva": "in zero-g",
  "context.ground_vehicle": "driving",
  "context.always": "in every situation",
  "context.out_of_game": "outside gameplay",

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
  "diag.rankHint":
    "The game numbers js1, js2… in this order. The order changes when you move a stick to another port, and that is what swaps your controls.",
  "diag.matched": "Found in profile",
  "diag.unmatched": "Not in profile",
  "diag.slotBindings": "bindings",
  "diag.slotNamed": "device named",
  "diag.slotAnonymous": "no device named",
  "diag.guidProduct": "Model GUID",
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

/**
 * Fonction de traduction pour une langue donnée.
 *
 * Accepte une chaîne quelconque plutôt que le seul type `Key` : les écrans
 * partagés de `@spacemapper/app-core` ne connaissent pas le vocabulaire
 * complet de cette édition. Ce qu'ils réclament est vérifié séparément, par
 * l'affectation `Record<CoreKey, string>` en fin de fichier.
 *
 * Une clé absente est renvoyée telle quelle : elle se voit à l'écran, là où
 * une chaîne vide passerait inaperçue.
 */
export function translator(lang: Lang): (key: string) => string {
  const table = TABLES[lang] ?? FR;
  return (key) => (table as Record<string, string>)[key] ?? key;
}

/**
 * Les écrans partagés (`@spacemapper/app-core`) réclament ce vocabulaire.
 *
 * L'affectation ne sert qu'au compilateur : une clé que ces écrans affichent
 * mais que cette table a oubliée devient une erreur de compilation, plutôt
 * qu'un libellé vide découvert à l'écran.
 */
const _coreKeyCoverage: Record<CoreKey, string> = FR;
void _coreKeyCoverage;
