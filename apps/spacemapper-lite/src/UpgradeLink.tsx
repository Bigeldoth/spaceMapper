import { openUrl } from "@tauri-apps/plugin-opener";
import { useT } from "./lib/i18nContext";

/**
 * Renvoi vers la page de vente.
 *
 * Dans son propre module plutôt que dans `App` : plusieurs panneaux l'affichent
 * et le faire remonter d'`App` créerait un cycle d'imports, `App` chargeant
 * déjà ces panneaux.
 *
 * Le lien part au navigateur du système sur clic explicite. Lite n'émet aucune
 * requête réseau lui-même — c'est vérifiable, son arbre de dépendances ne
 * contient aucun client HTTP.
 */
const TIPEEE_URL = "https://fr.tipeee.com/padek-interactive";

export default function UpgradeLink() {
  const t = useT();
  return (
    <button
      // L'ouverture peut échouer si la permission `opener:allow-open-url`
      // vient à manquer ; on ne veut pas d'un rejet non capturé pour autant.
      onClick={() => void openUrl(TIPEEE_URL).catch(() => {})}
      className="mt-3 rounded-md bg-accent-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-accent-700"
    >
      {t("upgrade.cta")}
    </button>
  );
}
