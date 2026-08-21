/**
 * Traduction des noms internes en libellés lisibles.
 *
 * C'est le premier argument du produit : `v_toggle_qdrive_engagement` ne dit
 * rien à personne, « Enclencher le saut quantique » se comprend d'un coup
 * d'œil. Le jeu n'expose ces noms nulle part de façon compréhensible.
 *
 * **Toutes les entrées ci-dessous ont été vérifiées contre un `actionmaps.xml`
 * réel.** Une première version de ce fichier reposait sur des noms reconstitués
 * de mémoire : 30 des 53 entrées désignaient des actions inexistantes. Elles ne
 * cassaient rien — le libellé retombe sur le nom brut — mais elles donnaient
 * l'illusion d'une couverture qui n'existait pas.
 *
 * La couverture est complète sur le périmètre éditable par Lite (déplacements
 * à pied et en vol) et partielle ailleurs. La Phase 3 régénérera ce catalogue
 * depuis `Data.p4k`, ce qui garantira l'exhaustivité à chaque patch.
 *
 * Pour re-vérifier après une mise à jour du jeu :
 * `python tools/audit_labels.py`
 */
/**
 * Libellé à afficher pour une assignation.
 *
 * Le vocabulaire du jeu prime : il est complet, traduit et suit les patchs,
 * quand le catalogue ci-dessous plafonne à quelques centaines d'entrées
 * écrites à la main. Ce dernier ne sert plus que de repli, lorsque l'archive
 * est illisible ou qu'une action n'y est pas traduite.
 */
export declare function bindingLabel(binding: {
    action: string;
    label: string | null;
}): string;
/** Libellé lisible, ou le nom brut si l'action n'est pas encore cataloguée. */
export declare function actionLabel(name: string): string;
/** L'action est-elle cataloguée ? Sert à nuancer l'affichage. */
export declare function isKnownAction(name: string): boolean;
export declare function categoryLabel(name: string): string;
