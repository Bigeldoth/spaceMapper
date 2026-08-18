"""Confronte le catalogue de libelles aux noms d'actions reels du jeu.

    python tools/audit_labels.py [chemin/vers/actionmaps.xml]

Sans argument, cherche le profil LIVE a l'emplacement habituel.

Pourquoi cet outil existe : une premiere version du catalogue avait ete ecrite
de memoire, et 30 de ses 53 entrees designaient des actions qui n'existent pas.
Rien ne cassait — un libelle absent retombe sur le nom brut — mais la
couverture affichee etait fictive. Ce script rend l'ecart mesurable, et doit
etre relance apres chaque patch majeur de Star Citizen.
"""

import re
import sys
from pathlib import Path

DEFAULT_PROFILE = Path(
    r"C:\Program Files\Roberts Space Industries\StarCitizen\LIVE"
    r"\user\client\0\Profiles\default\actionmaps.xml"
)
CATALOG = Path(__file__).resolve().parent.parent / (
    "apps/spacemapper-lite/src/lib/actionLabels.ts"
)


def main() -> int:
    profile = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_PROFILE
    if not profile.is_file():
        print(f"profil introuvable : {profile}", file=sys.stderr)
        return 1

    xml = profile.read_text(encoding="utf-8", errors="replace")
    catalog_src = CATALOG.read_text(encoding="utf-8")

    real_actions = set(re.findall(r'<action name="([^"]+)"', xml))
    real_categories = set(re.findall(r'<actionmap name="([^"]+)"', xml))

    # Les cles indentees de deux espaces sont les entrees des dictionnaires.
    keys = set(re.findall(r'^\s{2}([A-Za-z_][A-Za-z0-9_]*):\s*"', catalog_src, re.M))

    # Les emotes sont catalogues sans leur prefixe : `wave` couvre
    # `emote_wave`. On les remet sous leur forme reelle avant comparaison.
    emote_stems = _emote_keys(catalog_src)
    action_keys = {k for k in keys if k not in real_categories and k not in emote_stems}
    action_keys |= {f"emote_{stem}" for stem in emote_stems}

    known = action_keys & real_actions
    unknown = sorted(action_keys - real_actions)
    missing = sorted(real_actions - action_keys)

    print(f"actions du profil        : {len(real_actions)}")
    print(f"entrees du catalogue     : {len(action_keys)}")
    print(f"  correspondent          : {len(known)}")
    print(f"  sans correspondance    : {len(unknown)}")
    print(f"actions sans libelle     : {len(missing)}")

    if unknown:
        print("\n--- entrees du catalogue absentes du jeu ---")
        for name in unknown:
            print(" ", name)

    print("\n--- actions sans libelle (extrait) ---")
    for name in missing[:40]:
        print(" ", name)
    if len(missing) > 40:
        print(f"  ... et {len(missing) - 40} autres")

    # Une entree fantome est un defaut a corriger ; une action sans libelle est
    # seulement une couverture incomplete, ce qui est attendu a ce stade.
    return 1 if unknown else 0


def _emote_keys(src: str) -> set[str]:
    """Radicaux du dictionnaire des emotes, sans le prefixe `emote_`."""
    block = re.search(r"const EMOTES[^{]*\{(.*?)\n\};", src, re.S)
    if not block:
        return set()
    return set(re.findall(r"^\s{2}(\w+):", block.group(1), re.M))


if __name__ == "__main__":
    raise SystemExit(main())
