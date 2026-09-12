#!/usr/bin/env python3
"""Run the real Premium merge and TypeScript conflict engine on read-only XML.

The generated Rust harness extracts collect_editable/collect_overrides and the
context matrix verbatim from editing.rs. Sources are snapshotted before running
so the baseline stays reproducible while application changes are in progress.
Only the requested report and temporary harness files are written.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
PREMIUM = ROOT.parent / 'spaceMapper-premium'


def rust_item(source, marker):
    start = source.index(marker)
    opening = source.index('{', start)
    depth = 1
    cursor = opening + 1
    while depth:
        if source[cursor] == '{':
            depth += 1
        elif source[cursor] == '}':
            depth -= 1
        cursor += 1
    return source[start:cursor]


def snapshot_sources(destination, premium):
    vendor = premium / 'vendor' / 'spaceMapper'
    destination.mkdir(parents=True)
    shutil.copytree(vendor / 'crates' / 'spacemapper-core', destination / 'spacemapper-core')
    shutil.copyfile(vendor / 'Cargo.toml', destination / 'workspace-Cargo.toml')
    shutil.copyfile(premium / 'apps' / 'spacemapper-premium' / 'src-tauri' / 'src' / 'editing.rs', destination / 'editing.rs')
    for name in ('activation.ts', 'conflicts.ts'):
        shutil.copyfile(vendor / 'packages' / 'app-core' / 'src' / 'lib' / name, destination / name)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--snapshot', type=Path)
    parser.add_argument('--premium', type=Path, default=PREMIUM)
    parser.add_argument('--profile', type=Path, default=Path('C:/Program Files/Roberts Space Industries/StarCitizen/LIVE/user/client/0/Profiles/default/actionmaps.xml'))
    parser.add_argument('--defaults', type=Path, default=Path(os.environ['TEMP']) / 'defaultProfile.decoded.xml')
    parser.add_argument('--reviews', type=Path, default=ROOT.parent / 'retours-mapping' / 'data' / 'retours-conflits.json')
    parser.add_argument('--imported-reviews', type=Path, default=Path(os.environ['APPDATA']) / 'SpaceMapper-Premium' / 'conflict-reviews.json')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    snapshot = args.snapshot
    if snapshot is None:
        snapshot = Path(tempfile.mkdtemp(prefix='spacemapper-diagnostic-')) / 'snapshot'
        snapshot_sources(snapshot, args.premium)
    source = (snapshot / 'editing.rs').read_text(encoding='utf-8-sig')
    workspace = (snapshot / 'workspace-Cargo.toml').read_text(encoding='utf-8-sig')
    workspace = re.sub(r'members\s*=\s*\[.*?\]', 'members = ["spacemapper-core", "runner"]', workspace, count=1, flags=re.S)
    workspace = workspace.replace('path = "crates/spacemapper-core"', 'path = "spacemapper-core"')
    (snapshot / 'Cargo.toml').write_text(workspace, encoding='utf-8')
    runner = snapshot / 'runner'
    (runner / 'src').mkdir(parents=True, exist_ok=True)
    (runner / 'Cargo.toml').write_text('''[package]
name = "diagnostic-profile-audit"
version = "0.0.0"
edition = "2021"

[dependencies]
spacemapper-core = { path = "../spacemapper-core" }
serde = { workspace = true }
serde_json = { workspace = true }
''', encoding='utf-8')
    definitions = ('#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]\n'
                   '#[serde(rename_all = "snake_case")]\n' + rust_item(source, 'pub enum Origin') + '\n'
                   '#[derive(Debug, Serialize)]\n' + rust_item(source, 'pub struct EditableBinding'))
    harness = '''use serde::Serialize;
use spacemapper_core::actionmaps::{self, ActionMaps, DeviceKind, InputBinding};
use spacemapper_core::context::{self, Context};
use spacemapper_core::defaults::DefaultProfile;
use std::collections::HashSet;
'''
    if 'TriggerAttributes' in definitions:
        harness += 'use spacemapper_core::triggers::TriggerAttributes;\n'
    harness += definitions + '\n'
    for marker in ('fn collect_editable(', 'fn collect_overrides(', 'fn colliding_contexts('):
        harness += rust_item(source, marker) + '\n'
    harness += '''fn main() {
    let args: Vec<String> = std::env::args().collect();
    let profile_xml = std::fs::read_to_string(&args[1]).unwrap();
    let defaults_xml = std::fs::read_to_string(&args[2]).unwrap();
    let maps = actionmaps::parse_str(&profile_xml).unwrap();
    let defaults = spacemapper_core::defaults::parse_str(&defaults_xml).unwrap();
    let bindings = collect_editable(&maps, Some(&defaults));
    println!("{}", serde_json::to_string(&serde_json::json!({
        "bindings": bindings,
        "colliding_contexts": colliding_contexts(),
        "default_action_count": defaults.action_maps.iter().map(|m| m.actions.len()).sum::<usize>(),
        "profile_rebind_count": maps.rebinds().count()
    })).unwrap());
}
'''
    (runner / 'src' / 'main.rs').write_text(harness, encoding='utf-8')
    env = os.environ.copy()
    rust_bin = str(Path.home() / '.rustup/toolchains/stable-x86_64-pc-windows-msvc/bin')
    env['PATH'] = rust_bin + os.pathsep + env['PATH']
    command = [str(Path(rust_bin) / 'cargo.exe'), 'run', '--quiet', '--offline', '-p', 'diagnostic-profile-audit', '--', str(args.profile), str(args.defaults)]
    merged = subprocess.run(command, cwd=snapshot, env=env, capture_output=True, text=True, encoding='utf-8')
    if merged.returncode:
        raise RuntimeError(merged.stderr)
    merged_path = snapshot / 'merged-bindings.json'
    merged_path.write_text(merged.stdout, encoding='utf-8')
    provenance = {'snapshot_directory': str(snapshot), 'source_kind': 'exact_rust_merge_and_typescript_runtime', 'sources': {}}
    for name, path in [('profile', args.profile), ('defaults', args.defaults), ('reviews', args.reviews), ('editing', snapshot / 'editing.rs'), ('context', snapshot / 'spacemapper-core/src/context.rs'), ('defaults_parser', snapshot / 'spacemapper-core/src/defaults.rs'), ('conflicts', snapshot / 'conflicts.ts'), ('activation', snapshot / 'activation.ts')]:
        provenance['sources'][name] = {'path': str(path), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
    (snapshot / 'provenance.json').write_text(json.dumps(provenance, indent=2), encoding='utf-8')
    args.output.parent.mkdir(parents=True, exist_ok=True)
    result = subprocess.run(['node', str(ROOT / 'tools/diagnostic-profile-audit.mjs'), str(snapshot), str(args.reviews), str(args.output), str(args.imported_reviews)], cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
    if result.returncode:
        raise RuntimeError(result.stderr)
    print(result.stdout, end='')


if __name__ == '__main__':
    main()
