import { openUrl } from "@tauri-apps/plugin-opener";
import { Button } from "@spacemapper/ui";
import { useT } from "@spacemapper/app-core";

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
    <Button
      // L'ouverture peut échouer si la permission `opener:allow-open-url`
      // vient à manquer ; on ne veut pas d'un rejet non capturé pour autant.
      onClick={() => void openUrl(TIPEEE_URL).catch(() => {})}
      className="mt-3"
    >
      {t("upgrade.cta")}
    </Button>
  );
}
