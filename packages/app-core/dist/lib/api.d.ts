import type { TriggerSignature } from "./activation";
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
export interface BuildInfo {
    edition: string;
    channel: string;
    version: string;
}
/**
 * Taxonomie propre au périmètre restreint de Lite.
 *
 * Absente des réponses de Premium, dont aucune catégorie n'est hors de
 * portée — d'où les champs optionnels sur [`EditableBinding`].
 */
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
    /** Renseignés par Lite seulement : Premium ne classe pas par périmètre. */
    category?: EditCategory;
    access?: EditAccess;
    origin: Origin;
    action: string;
    /** Libellé fourni par le jeu, dans la langue choisie. */
    label: string | null;
    /** Description fournie par le jeu. Souvent vide hors anglais. */
    description: string | null;
    /** Groupe utilisé par la politique de diagnostic des conflits. */
    context: Context;
    input_raw: string;
    device: string | null;
    /** Touche modificatrice, ex. `lshift` dans `kb1_lshift+f`. */
    modifier: string | null;
    control: string | null;
    /**
     * `Some("press")`, etc. Jamais un motif de verrouillage — seulement de quoi
     * afficher un contexte pour qui édite une assignation qui en porte un :
     * l'écriture (`spacemapper_edit::writer`) préserve ces attributs sans
     * intervention de l'interface.
     */
    activation_mode: string | null;
    multi_tap: string | null;
    /** Déclencheur résolu pour ce contrôle : mode + action + périphérique + surcharge. */
    trigger_attributes?: Record<string, string>;
    /** Attributs locaux hérités ou surchargés, hors expansion du mode nommé. */
    explicit_trigger_attributes?: Record<string, string>;
    /**
     * Motif du verrouillage, ou `null`/absent si l'assignation est modifiable.
     * Absent des réponses de Premium, qui n'en produit jamais — d'où
     * l'optionalité, au même titre que `category`/`access`.
     */
    lock?: LockReason | null;
}
/**
 * Pourquoi une assignation ne peut pas être modifiée ici.
 *
 * Un code plutôt qu'une phrase : le texte dépend de la langue de l'interface,
 * que le backend ne connaît pas.
 *
 * Les deux relèvent du périmètre commercial de Lite ; Premium ne produit
 * jamais de verrou.
 */
export type LockReason = "dangerous_action" | "premium_category";
/**
 * Groupe de commandes utilisé par le diagnostic des conflits.
 *
 * La politique exclut certains groupes et autorise les croisements utiles,
 * notamment entre les commandes à pied et l'interface/HUD.
 */
export type Context = "on_foot" | "ship_seat" | "ship_scanning" | "ship_mining" | "ship_salvage" | "turret" | "eva" | "ground_vehicle" | "map" | "interface_hud" | "always" | "out_of_game";
export interface MergedBindings {
    bindings: EditableBinding[];
    /** Motif d'indisponibilité des valeurs par défaut, le cas échéant. */
    defaults_error: string | null;
    /**
     * Paires de groupes comparés par le diagnostic, calculées par le backend.
     *
     * La règle vit en Rust, où elle est testée. La réimplémenter ici
     * garantirait de la voir diverger au premier patch du jeu.
     */
    colliding_contexts: [Context, Context][];
    /** Observations personnelles importées, limitées à leur paire et déclencheurs exacts. */
    conflict_reviews?: ConflictReview[];
    /** Erreur d'import du carnet ; les raccourcis restent disponibles. */
    conflict_reviews_error?: string | null;
    /** Modes lus dans la version installée du jeu, pour les modifications en attente. */
    activation_modes?: Record<string, Record<string, string>>;
}
export interface ConflictReviewAction {
    actionmap: string;
    action: string;
    trigger_signature: TriggerSignature;
}
export interface ConflictReview {
    control: string;
    actions: [ConflictReviewAction, ConflictReviewAction];
    verdict: "false_alarm" | "real_conflict";
}
/** Une modification en attente d'enregistrement. `input: null` efface. */
export interface PendingEdit {
    actionmap: string;
    action: string;
    input: string | null;
    /**
     * Valeur `input` de la ligne éditée avant modification, quand l'action
     * porte plusieurs lignes à la fois. C'est ce qui distingue laquelle des
     * deux modifier — une correspondance de préfixe (`js1`) se serait aussi
     * vue matcher `js10`, un vrai risque pour les configurations
     * HOSAS/multi-manche. `null` cible la première assignation trouvée, comme
     * avant l'ajout de ce champ — le seul cas courant tant qu'une action n'a
     * qu'une ligne.
     */
    original_input: string | null;
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
export type Finding = {
    kind: "anonymous_slots";
    instances: number[];
} | {
    kind: "ambiguous_model";
    product_name: string;
    count: number;
} | {
    kind: "declared_but_absent";
    name: string;
} | {
    kind: "plugged_but_unused";
    name: string;
} | {
    kind: "more_slots_than_devices";
    slots: number;
    devices: number;
} | {
    kind: "corrupt_bindings";
    count: number;
};
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
/** Un profil exporté trouvé dans `Controls\mappings`. */
export interface LayoutFile {
    path: string;
    file_name: string;
    label: string | null;
    description: string | null;
    bindings: number;
}
/** Périphérique attendu par un profil, confronté au matériel branché. */
export interface ExpectedDevice {
    slot: string;
    kind: string;
    product_name: string | null;
    guid: string | null;
    /** 0 : appareil absent. 2+ : le GUID ne désigne pas lequel. */
    matching_devices: number;
    bindings: number;
}
export interface CategorySummary {
    actionmap: string;
    bindings: number;
}
export interface LayoutInspection {
    path: string;
    file_name: string;
    label: string | null;
    description: string | null;
    profile_name: string | null;
    expected_devices: ExpectedDevice[];
    categories: CategorySummary[];
    bindings: number;
    corrupt: number;
    with_modifier: number;
    with_activation_mode: number;
    with_multi_tap: number;
}
export declare const api: {
    listDevices: () => Promise<DeviceView[]>;
    locateActionmaps: () => Promise<ProfileLocation[]>;
    buildInfo: () => Promise<BuildInfo>;
    /** Confronte le profil au matériel branché. */
    diagnoseDevices: (path: string) => Promise<Diagnosis>;
    /** Profils exportés présents dans `Controls\mappings`. */
    listLayouts: (path: string) => Promise<LayoutFile[]>;
    /** Détaille un profil exporté, sans rien y écrire. */
    inspectLayout: (path: string) => Promise<LayoutInspection>;
    /** Surcharges du joueur fusionnées avec les valeurs par défaut du jeu. */
    listEditableBindings: (path: string) => Promise<MergedBindings>;
    /**
     * Écrit un lot de modifications en une seule fois.
     * Renvoie le chemin du point de restauration créé, ou `null`.
     */
    saveBindings: (path: string, edits: PendingEdit[], createRestorePoint: boolean) => Promise<string | null>;
    /** Crée un point de restauration ; renvoie le chemin du fichier créé. */
    createBackup: (path: string) => Promise<string>;
    listBackups: () => Promise<BackupView[]>;
    /**
     * Supprime définitivement un point de restauration.
     *
     * Le backend refuse toute cible qui n'est pas une sauvegarde de SpaceMapper :
     * il détermine lui-même le dossier autorisé et ne se fie pas à ce chemin.
     */
    deleteBackup: (backupPath: string) => Promise<void>;
    /** Langues réellement présentes dans l'installation du joueur. */
    listGameLanguages: (path: string) => Promise<Language[]>;
    getSettings: () => Promise<Settings>;
    setSettings: (settings: Settings) => Promise<void>;
    /**
     * Ouvre une session de lecture sur plusieurs périphériques à la fois.
     * Renvoie le numéro de session, à repasser à `stopCapture`.
     */
    startCapture: (guids: string[]) => Promise<number>;
    /** Dernier contrôle actionné, ou `null` si rien n'a été pressé. */
    pollCapture: () => Promise<CapturedInput | null>;
    /** Oublie le dernier relevé sans fermer la session. */
    clearCapture: () => Promise<void>;
    /** N'arrête que la session désignée : voir le commentaire côté Rust. */
    stopCapture: (id: number) => Promise<void>;
    restoreBackup: (path: string, backupPath: string) => Promise<void>;
};
