# SPDX-License-Identifier: AGPL-3.0-only
"""Bounded standard-library ZIP creation, inspection and clean extraction."""
import base64
import hashlib
import json
import pathlib
import re
import stat
import sys
import zipfile


def safe_name(name):
    path = pathlib.PurePosixPath(name)
    reserved = any(part.rstrip(' .') != part or re.match(r'^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)', part, re.I) for part in path.parts)
    if not name or not path.parts or reserved or '\\' in name or ':' in name or '\x00' in name or path.is_absolute() or '..' in path.parts or str(path) != name:
        raise ValueError('Unsafe archive path')
    return name


def main(request):
    if request['mode'] == 'create':
        names = set()
        with zipfile.ZipFile(request['path'], 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
            for item in sorted(request['files'], key=lambda row: row['name']):
                name = safe_name(item['name'])
                if name in names:
                    raise ValueError('Duplicate archive path')
                names.add(name)
                info = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
                info.compress_type = zipfile.ZIP_DEFLATED
                info.external_attr = (stat.S_IFREG | 0o644) << 16
                archive.writestr(info, pathlib.Path(item['path']).read_bytes())
        return {'files': len(names)}
    if request['mode'] not in ['inspect', 'extract']:
        raise ValueError('Unknown archive operation')
    destination = None
    if request['mode'] == 'extract':
        destination = pathlib.Path(request['destination']).resolve()
        destination.mkdir(parents=True, exist_ok=False)
    rows, names, total = [], set(), 0
    with zipfile.ZipFile(request['path']) as archive:
        if len(archive.infolist()) > 2000:
            raise ValueError('Too many archive entries')
        for item in archive.infolist():
            # Windows ZipInfo normalizes backslashes in filename; inspect the
            # original central-directory name before accepting/extracting it.
            name = safe_name(item.orig_filename)
            if item.is_dir() or stat.S_ISLNK(item.external_attr >> 16) or name in names or item.file_size > 20 * 1024 * 1024:
                raise ValueError('Invalid archive entry')
            names.add(name)
            total += item.file_size
            if total > 100 * 1024 * 1024:
                raise ValueError('Archive exceeds byte budget')
            data = archive.read(item)
            row = {'name': name, 'size': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
            if name in request.get('read', []):
                row['base64'] = base64.b64encode(data).decode('ascii')
            rows.append(row)
            if destination is not None:
                output = (destination / name).resolve()
                if not output.is_relative_to(destination):
                    raise ValueError('Extraction escaped destination')
                output.parent.mkdir(parents=True, exist_ok=True)
                with output.open('xb') as stream:
                    stream.write(data)
    return {'files': rows, 'bytes': total}


try:
    print(json.dumps(main(json.load(sys.stdin)), ensure_ascii=True))
except Exception as error:
    print(str(error), file=sys.stderr)
    sys.exit(1)
