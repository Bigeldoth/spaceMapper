"""Import an external review notebook into per-profile application data.

No notebook or game file is changed. Only explicit user verdicts are imported.
"""
import argparse
from collections import Counter
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import tempfile


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--notebook', type=Path, required=True)
    parser.add_argument('--profile', type=Path, required=True)
    parser.add_argument('--app-name', default='SpaceMapper-Premium', choices=['SpaceMapper', 'SpaceMapper-Premium'])
    parser.add_argument('--output', type=Path)
    args = parser.parse_args()
    raw = args.notebook.read_bytes()
    notebook = json.loads(raw)
    if notebook.get('schema_version') != 1:
        raise ValueError('Unsupported notebook version')
    profile = args.profile.resolve(strict=True)
    profile_hash = hashlib.sha256(profile.read_bytes()).hexdigest()
    source_hashes = {f.get('catalog_meta', {}).get('profile_hash') for f in notebook['feedback'].values()}
    if source_hashes != {profile_hash}:
        raise ValueError('The reviewed profile has changed. Reconcile its bindings before importing these observations.')
    reviews = []
    for feedback in notebook['feedback'].values():
        if feedback['verdict'] not in {'false_alarm', 'real_conflict'}:
            continue
        case = feedback['case_snapshot']
        if len(case['actions']) != 2 or any(not a.get('trigger_signature') for a in case['actions']):
            raise ValueError(f"Missing trigger information for {feedback['case_id']}")
        actions = []
        for action in case['actions']:
            actionmap, name = action['id'].split('/', 1)
            actions.append({'actionmap': actionmap, 'action': name, 'trigger_signature': action['trigger_signature']})
        reviews.append({'control': case['control_raw'], 'actions': actions, 'verdict': feedback['verdict'],
                        'source_case_id': feedback['case_id'], 'reason': feedback.get('reason', ''),
                        'comment': feedback.get('comment', ''), 'reviewed_at': feedback['updated_at']})
    output = args.output or Path(os.environ['APPDATA']) / args.app_name / 'conflict-reviews.json'
    content = json.loads(output.read_text(encoding='utf-8')) if output.exists() else {'schema_version': 1, 'profiles': []}
    if content.get('schema_version') != 1 or not isinstance(content.get('profiles'), list):
        raise ValueError('Existing observations are invalid; preserved without modification')
    profile_path = str(profile)
    content['profiles'] = [p for p in content['profiles']
                           if os.path.normcase(os.path.normpath(p['profile_path'])) != os.path.normcase(profile_path)]
    content['profiles'].append({'profile_path': profile_path, 'imported_at': datetime.now(timezone.utc).isoformat(),
        'source': {'notebook_sha256': hashlib.sha256(raw).hexdigest(), 'revision': notebook['revision'],
                   'profile_sha256': profile_hash}, 'reviews': reviews})
    output.parent.mkdir(parents=True, exist_ok=True)
    if output.exists():
        backup = output.with_name(output.stem + '.before-' + datetime.now().strftime('%Y%m%d-%H%M%S-%f') + '.json')
        shutil.copy2(output, backup)
    descriptor, temporary = tempfile.mkstemp(prefix='.reviews-', suffix='.tmp', dir=output.parent)
    try:
        with os.fdopen(descriptor, 'w', encoding='utf-8') as stream:
            json.dump(content, stream, ensure_ascii=False, indent=2)
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, output)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)
    print(json.dumps({'output': str(output), 'reviews': dict(Counter(r['verdict'] for r in reviews))}))


if __name__ == '__main__':
    main()
