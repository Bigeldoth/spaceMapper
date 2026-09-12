#!/usr/bin/env python3
"""Read-only inventory of Star Citizen XML shortcut declarations (stdlib only).

Defaults and explicit overrides are deliberately separate datasets. This is not
an emulation of the engine's active action maps, input consumption, or merging.
Only the requested JSON output is written; XML sources are never modified.
"""
from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
from itertools import combinations
import json
from pathlib import Path
import re
import xml.etree.ElementTree as ET

FAMILIES = ("keyboard", "mouse", "joystick", "gamepad")
PREFIXES = {"kb": "keyboard", "mo": "mouse", "js": "joystick", "gp": "gamepad"}
# XML attribute names are case-sensitive. Preserve the observed case variants
# below, but only canonical activationMode is interpreted by usage().
TRIGGER_KEYS = ("activationMode", "ActivationMode", "activationmode",
                "multiTap", "multiTapBlock", "onPress", "onHold", "onRelease",
                "pressTriggerThreshold", "releaseTriggerThreshold",
                "pressTriggerDelay", "releaseTriggerDelay", "holdTriggerDelay",
                "holdRepeatDelay", "pressDelayPriority", "releaseDelayPriority",
                "retriggerable", "always", "noModifiers", "useAnalogCompare",
                "analogCompareVal", "analogCompareOp", "priority", "block",
                "inputBlock", "inputBlockTime", "inputBlockActivation")
EXCLUDED = {"out_of_game", "ground_vehicle", "map", "eva"}


def context_of(name):
    if name in {"player", "player_choice", "player_emotes", "player_input_optical_tracking",
                "prone", "hacking", "tractor_beam", "mining", "incapacitated"}:
        return "on_foot"
    if name in {"spaceship_scanning", "spaceship_mining", "spaceship_salvage"}:
        return name.replace("spaceship_", "ship_")
    if name == "mapui" or name.startswith("mapui_"):
        return "map"
    if name.startswith("zero_gravity_"):
        return "eva"
    if name in {"default", "vehicle_mobiglas", "spaceship_hud"} or name.startswith("ui_"):
        return "interface_hud"
    if name in {"debug", "spectator", "flycam", "view_director_mode", "character_customizer",
                "RemoteRigidEntityController", "server_renderer"} or name.startswith("spectator_"):
        return "out_of_game"
    if name.startswith("spaceship_") or name in {"seat_general", "vehicle_mfd", "lights_controller", "IFCS_controls"}:
        return "ship_seat"
    if name.startswith("player_"):
        return "on_foot"
    if name.startswith("turret_"):
        return "turret"
    if name.startswith("vehicle_"):
        return "ground_vehicle"
    return "always"


def current_policy_allows(a, b):
    if a in EXCLUDED or b in EXCLUDED:
        return False
    if a == "on_foot" or b == "on_foot":
        return a == b or "interface_hud" in (a, b)
    if a in {"always", "interface_hud"} or b in {"always", "interface_hud"}:
        return True
    if a == b:
        return True
    return "ship_seat" in (a, b) and bool({a, b} & {"ship_scanning", "ship_mining", "ship_salvage"})


def usage(mode, multi_tap):
    """Mirror current app classification, not physical event compatibility."""
    raw = (multi_tap or "").strip()
    if raw:
        if not re.fullmatch(r"[0-9]+", raw) or int(raw) < 1:
            return "unknown"
        if int(raw) > 1:
            return f"multi_tap:{int(raw)}"
    mode = (mode or "").strip().lower()
    if mode in {"", "tap", "tap_quicker", "press", "press_quicker", "hold", "hold_toggle",
                "hold_no_retrigger", "all", "smart_toggle"}:
        return "short_press"
    if mode in {"delayed_press", "delayed_press_quicker", "delayed_press_medium", "delayed_press_long",
                "delayed_hold", "delayed_hold_long", "delayed_hold_no_retrigger"}:
        return "long_press"
    if mode in {"double_tap", "double_tap_nonblocking"}:
        return "multi_tap:2"
    return "unknown"


def tree(node):
    result = {"tag": node.tag, "attributes": dict(node.attrib)}
    if len(node):
        result["children"] = [tree(c) for c in node]
    if (node.text or "").strip():
        result["text"] = node.text.strip()
    return result


def source_meta(path):
    content = path.read_bytes()
    return {"file_name": path.name, "sha256": hashlib.sha256(content).hexdigest(),
            "size_bytes": len(content),
            "modified_utc": datetime.fromtimestamp(path.stat().st_mtime, timezone.utc).isoformat()}


def inherited(levels, key):
    for label, attributes in reversed(levels):
        if key in attributes:
            return attributes[key], label
    return None, "implicit"


def binding_record(action_id, family, raw, levels, location, mode_definitions, override=False):
    mode, mode_source = inherited(levels, "activationMode")
    multi_tap, multi_source = inherited(levels, "multiTap")
    triggers = {}
    for _, attrs in levels:
        triggers.update({k: attrs[k] for k in TRIGGER_KEYS if k in attrs})
    definition = mode_definitions.get(mode or "", {})
    resolved_triggers = dict(definition)
    resolved_triggers.pop("name", None)
    resolved_triggers.update(triggers)
    instance = None
    control = raw.strip()
    status = "bound" if control else "unbound"
    token = None
    if override:
        match = re.fullmatch(r"(kb|mo|js|gp)([0-9]+)_(.*)", raw, re.DOTALL)
        if match:
            family = PREFIXES[match[1]]
            instance = int(match[2])
            control = match[3].strip()
            status = "bound" if control else "unbound_on_device"
            token = raw if control else None
        elif control:
            status = "unparseable"
    elif control:
        # Defaults do not identify a physical device instance; never invent one.
        token = f"{family}:*_{control}"
    return {"action_id": action_id, "family": family, "instance": instance,
            "input_raw": raw, "control_with_modifiers": control, "comparison_token": token,
            "status": status, "declaration": location,
            "activation_mode": mode, "activation_mode_source": mode_source,
            "multi_tap": multi_tap, "multi_tap_source": multi_source,
            "usage_under_current_spacemapper_rule": usage(mode, multi_tap),
            "explicit_trigger_attributes": triggers, "resolved_trigger_attributes": resolved_triggers}


def defaults_inventory(root, modes):
    categories = []
    lookup = {}
    for map_node in root.findall("actionmap"):
        name = map_node.get("name")
        actions = []
        for action in map_node.findall("action"):
            action_id = f"{name}/{action.get('name')}"
            levels = [("default_action", action.attrib)]
            declarations = []
            family_nodes = {family: action.findall(family) for family in FAMILIES}
            for family in FAMILIES:
                nodes = family_nodes[family]
                family_attrs = nodes[0].attrib if nodes else {}
                family_levels = levels + [("default_family", family_attrs)]
                if family in action.attrib:
                    declarations.append(binding_record(action_id, family, action.attrib[family],
                        family_levels, f"action@{family}", modes))
                for index, node in enumerate(nodes):
                    node_levels = levels + [("default_family", node.attrib)]
                    if "input" in node.attrib:
                        declarations.append(binding_record(action_id, family, node.attrib["input"],
                            node_levels, f"{family}[{index}]@input", modes))
                    for child_index, child in enumerate(node.iter()):
                        if child is not node and "input" in child.attrib:
                            declarations.append(binding_record(action_id, family, child.attrib["input"],
                                node_levels + [("default_input_child", child.attrib)],
                                f"{family}[{index}]/{child.tag}[{child_index}]@input", modes))
            record = {"id": action_id, "attributes": dict(action.attrib),
                      "children": [tree(child) for child in action], "input_declarations": declarations}
            actions.append(record)
            lookup[(name, action.get("name"))] = action
        categories.append({"name": name, "attributes": dict(map_node.attrib),
                           "current_diagnostic_context": context_of(name), "actions": actions})
    return categories, lookup


def overrides_inventory(root, modes, lookup):
    categories = []
    for map_node in root.findall(".//actionmap"):
        name = map_node.get("name")
        actions = []
        for action in map_node.findall("action"):
            action_id = f"{name}/{action.get('name')}"
            default = lookup.get((name, action.get("name")))
            declarations = []
            for index, rebind in enumerate(action.findall("rebind")):
                raw = rebind.get("input", "")
                match = re.match(r"(kb|mo|js|gp)[0-9]+_", raw)
                family = PREFIXES[match[1]] if match else None
                levels = []
                if default is not None:
                    levels.append(("default_action", default.attrib))
                    family_node = default.find(family) if family else None
                    if family_node is not None:
                        levels.append(("default_family", family_node.attrib))
                levels.extend([("override_action", action.attrib), ("override_rebind", rebind.attrib)])
                declarations.append(binding_record(action_id, family, raw, levels,
                    f"rebind[{index}]@input", modes, override=True))
            actions.append({"id": action_id, "attributes": dict(action.attrib),
                            "children": [tree(child) for child in action],
                            "known_in_defaults": default is not None, "input_declarations": declarations})
        categories.append({"name": name, "attributes": dict(map_node.attrib),
                           "current_diagnostic_context": context_of(name), "actions": actions})
    return categories


def analyse(categories):
    declarations = [d for c in categories for a in c["actions"] for d in a["input_declarations"]]
    # One key may be declared twice (direct + child). Keep declarations in the
    # inventory but do not inflate duplicate-pair counts with identical entries.
    bound = {}
    for item in declarations:
        if item["status"] == "bound":
            key = (item["action_id"], item["comparison_token"], item["activation_mode"], item["multi_tap"])
            bound.setdefault(key, item)
    rows = list(bound.values())
    groups = defaultdict(list)
    for row in rows:
        groups[row["comparison_token"]].append(row)
    pairs_count = Counter()
    context_pairs = defaultdict(Counter)
    within_category = {c["name"]: Counter() for c in categories}
    samples = defaultdict(list)
    shared_groups = []
    for token, group in sorted(groups.items()):
        if len({row["action_id"] for row in group}) > 1:
            shared_groups.append({"token": token, "bindings": [{k: row[k] for k in
                ("action_id", "activation_mode", "multi_tap", "usage_under_current_spacemapper_rule")} for row in group]})
        for left, right in combinations(group, 2):
            if left["action_id"] == right["action_id"]:
                continue
            left_map, right_map = left["action_id"].split("/")[0], right["action_id"].split("/")[0]
            lc, rc = context_of(left_map), context_of(right_map)
            lg, rg = left["usage_under_current_spacemapper_rule"], right["usage_under_current_spacemapper_rule"]
            same_usage = lg == rg
            overlap = same_usage or "unknown" in (lg, rg)
            allowed = current_policy_allows(lc, rc)
            cp = "|".join(sorted((lc, rc)))
            flags = {"exact_token_pairs": True, "same_usage_pairs": same_usage,
                     "unknown_usage_pairs": "unknown" in (lg, rg), "different_known_usage_pairs": not overlap,
                     "context_excluded_same_or_unknown_usage_pairs": overlap and not allowed,
                     "context_allowed_same_or_unknown_usage_pairs": overlap and allowed,
                     "same_actionmap_pairs": left_map == right_map,
                     "same_actionmap_same_or_unknown_usage_pairs": left_map == right_map and overlap}
            for key, value in flags.items():
                if value:
                    pairs_count[key] += 1
                    context_pairs[cp][key] += 1
                    if left_map == right_map:
                        within_category[left_map][key] += 1
            example = {"token": token, "left": left["action_id"], "right": right["action_id"],
                       "left_activation": left["activation_mode"], "right_activation": right["activation_mode"],
                       "left_usage": lg, "right_usage": rg, "same_actionmap": left_map == right_map,
                       "current_context_policy_allows_comparison": allowed}
            buckets = ["context_pair:" + cp]
            if overlap and not allowed:
                buckets.append("excluded_same_or_unknown_usage")
                if lc == rc:
                    buckets.append("excluded_within_context:" + lc)
                if left_map == right_map:
                    buckets.append("excluded_within_actionmap:" + left_map)
            if not overlap:
                buckets.append("different_usage")
            for bucket in buckets:
                if len(samples[bucket]) < 10:
                    samples[bucket].append(example)
    summary = {
        "actionmap_count": len(categories), "action_count": sum(len(c["actions"]) for c in categories),
        "input_declaration_count_including_blanks": len(declarations),
        "declaration_status_counts": dict(sorted(Counter(d["status"] for d in declarations).items())),
        "bound_declaration_count_before_deduplication": sum(d["status"] == "bound" for d in declarations),
        "distinct_bound_binding_count": len(rows),
        "actions_with_bound_declaration": len({r["action_id"] for r in rows}),
        "distinct_comparison_token_count": len(groups), "shared_token_group_count": len(shared_groups),
        "bound_bindings_by_family": dict(sorted(Counter(r["family"] for r in rows).items())),
        "bound_bindings_by_activation_mode": dict(sorted(Counter(r["activation_mode"] if r["activation_mode"] is not None else "<absent>" for r in rows).items())),
        "bound_bindings_by_current_usage": dict(sorted(Counter(r["usage_under_current_spacemapper_rule"] for r in rows).items())),
        "pair_counts": dict(sorted(pairs_count.items())),
        "pair_counts_by_context_pair": {k: dict(sorted(v.items())) for k, v in sorted(context_pairs.items())},
        "same_actionmap_pair_counts": {k: {"exact_token_pairs": v["exact_token_pairs"],
            "same_usage_pairs": v["same_usage_pairs"],
            "context_excluded_same_or_unknown_usage_pairs": v["context_excluded_same_or_unknown_usage_pairs"]}
            for k, v in sorted(within_category.items())},
        "categories": [{"name": c["name"], "UILabel": c["attributes"].get("UILabel"),
            "UICategory": c["attributes"].get("UICategory"), "context": c["current_diagnostic_context"],
            "actions": len(c["actions"]),
            "bound_declarations": sum(d["status"] == "bound" for a in c["actions"] for d in a["input_declarations"])} for c in categories],
    }
    assert summary["action_count"] == len({a["id"] for c in categories for a in c["actions"]})
    assert summary["bound_declaration_count_before_deduplication"] >= len(rows)
    assert sum(summary["bound_bindings_by_family"].values()) == len(rows)
    assert sum(v["exact_token_pairs"] for v in context_pairs.values()) == pairs_count["exact_token_pairs"]
    assert pairs_count["exact_token_pairs"] == pairs_count["different_known_usage_pairs"] + pairs_count["context_excluded_same_or_unknown_usage_pairs"] + pairs_count["context_allowed_same_or_unknown_usage_pairs"]
    return {"summary": summary, "shared_token_groups": shared_groups,
            "pair_samples": dict(sorted(samples.items())), "categories": categories}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--defaults", type=Path, required=True)
    parser.add_argument("--overrides", type=Path, required=True)
    parser.add_argument("--build-manifest", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    inputs = [args.defaults, args.overrides] + ([args.build_manifest] if args.build_manifest else [])
    if args.output.resolve() in {p.resolve() for p in inputs}:
        parser.error("Output must not overwrite any input source")
    before = {str(path): source_meta(path) for path in inputs}
    defaults_root = ET.parse(args.defaults).getroot()
    overrides_root = ET.parse(args.overrides).getroot()
    if defaults_root.tag != "profile" or overrides_root.tag not in {"ActionMaps", "ActionProfiles"}:
        parser.error("Unexpected input XML root")
    modes = {node.get("name"): dict(node.attrib) for node in defaults_root.findall("ActivationModes/ActivationMode")}
    defaults_categories, lookup = defaults_inventory(defaults_root, modes)
    overrides_categories = overrides_inventory(overrides_root, modes, lookup)
    policy = Path(__file__).resolve().parents[1] / "crates/spacemapper-core/src/context.rs"
    report = {
        "schema_version": 1, "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "method": {
            "datasets": "Separate default declarations and explicit profile overrides; no complete effective-profile claim.",
            "default_tokens": "family:*_control: the XML does not identify a physical instance. Direct family attributes, family input attributes and descendant inputdata are retained; identical action/token/mode declarations are deduplicated only for pair counts.",
            "override_tokens": "Exact raw prefixed input string, including device instance and modifiers; blanks are not bound controls.",
            "activation_inheritance": "Input/rebind > family/override-action > default action; explicit empty attributes remain explicit. Raw XML attributes are all preserved. Resolved trigger attributes retain the selected event, timing, threshold, repeat, analog-comparison, modifier, priority and blocking attributes plus named-mode definitions. ActivationMode/activationmode case variants are retained verbatim but not interpreted; only canonical activationMode selects a named mode. The usage grouping mirrors SpaceMapper and does not simulate engine events.",
            "blank_overrides": "js1_ followed by whitespace is an explicit unbound value for joystick instance 1. Current SpaceMapper collect_editable suppresses fallback defaults for the entire action/device family if ANY recognized override exists, including such a blank. Engine instance-specific merging is not inferred here; the datasets are not merged.",
            "pair_units": "Unordered pairs of distinct action IDs sharing an exact comparison token. Same-usage and context counters concern the current diagnostic policy, not confirmed physical conflicts.",
            "limits": [
                "DefaultProfile.xml declares inputs but does not establish the complete activation/deactivation or consumption rules for action maps, states, seats, modes and UI focus.",
                "The current usage classifier groups press/hold/tap as short_press and delayed modes as long_press. Distinct labels are not proof that physical input events cannot overlap.",
                "Modifier priority, axis direction semantics, input filtering, actiongroup handling and simultaneous activation require separate engine or in-game validation.",
                "Nested default inputs are inventoried even where the current product parser only reads direct family controls.",
                "Explicit overrides are not the complete profile. Defaults are a separate dataset and are not necessarily still active after overrides.",
            ],
            "policy_snapshot": {"relative_path": "crates/spacemapper-core/src/context.rs", **source_meta(policy)},
        },
        "sources": {"defaults": before[str(args.defaults)], "overrides": before[str(args.overrides)]},
        "default_profile_attributes": dict(defaults_root.attrib),
        "activation_mode_definitions": modes,
        "actiongroups": [tree(node) for node in defaults_root.findall("actiongroup")],
        "defaults": analyse(defaults_categories),
        "explicit_overrides": analyse(overrides_categories),
    }
    if args.build_manifest:
        report["sources"]["build_manifest"] = before[str(args.build_manifest)]
        report["installed_build"] = json.loads(args.build_manifest.read_text(encoding="utf-8-sig"))["Data"]
    for path in inputs:
        assert source_meta(path) == before[str(path)], f"Source changed during audit: {path.name}"
    report["checks"] = {"source_files_unchanged_during_audit": True, "aggregate_count_assertions_passed": True}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    display_keys = ("actionmap_count", "action_count", "input_declaration_count_including_blanks",
                    "declaration_status_counts", "distinct_bound_binding_count", "pair_counts")
    print(json.dumps({"output": str(args.output), **{dataset: {key: report[dataset]["summary"][key]
        for key in display_keys} for dataset in ("defaults", "explicit_overrides")}}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
