import { type ProfileLocation } from "./lib/api";
/**
 * Réglages de l'application.
 *
 * Le choix du profil vit ici, et non en tête de chaque écran : on le fait une
 * fois, à l'installation ou lors d'un changement de canal. L'y laisser en
 * permanence coûtait un bandeau sur toutes les pages pour un réglage qu'on ne
 * touche presque jamais.
 *
 * Deux langues distinctes, et la distinction est volontaire : un joueur peut
 * vouloir l'interface en français tout en gardant les noms de commandes en
 * anglais, qui sont ceux qu'échange la communauté sur Spectrum et Reddit.
 *
 * Les langues proposées sont celles réellement présentes dans l'installation,
 * relevées dans l'archive : en proposer une absente mènerait à une liste de
 * commandes soudain sans nom.
 */
export default function SettingsPanel({ profilePath, profiles, onSelectProfile, onBrowse, onChanged, }: {
    profilePath: string | null;
    profiles: ProfileLocation[];
    onSelectProfile: (path: string) => void;
    onBrowse: () => void;
    onChanged: () => void;
}): import("react").JSX.Element;
