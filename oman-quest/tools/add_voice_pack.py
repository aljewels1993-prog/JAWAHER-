"""Build a teacher's voice pack into the game so every student hears it.

Usage:  python3 -I tools/add_voice_pack.py <oman-quest-voice-pack.zip>

Converts each recording to a small, loudness-normalised mono MP3 (plays on
every phone) in public/voice/, and writes public/voice/manifest.json.
"""
import json, os, subprocess, sys, tempfile, zipfile

src = sys.argv[1]
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', 'public', 'voice')
os.makedirs(out, exist_ok=True)
manifest_path = os.path.join(out, 'manifest.json')
manifest = {'version': 1, 'clips': {}}
if os.path.exists(manifest_path):
    manifest = json.load(open(manifest_path))

with zipfile.ZipFile(src) as z, tempfile.TemporaryDirectory() as tmp:
    pack = json.loads(z.read('manifest.json'))
    for key, name in pack['clips'].items():
        if not (key.startswith('en/') or key.startswith('ar/')) or '..' in key:
            continue
        raw = os.path.join(tmp, 'clip.' + name.rsplit('.', 1)[-1])
        open(raw, 'wb').write(z.read(name))
        dest_rel = key + '.mp3'
        dest = os.path.join(out, dest_rel)
        os.makedirs(os.path.dirname(dest), exist_ok=True)
        subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', raw, '-ac', '1', '-ar', '44100',
                        '-af', 'silenceremove=start_periods=1:start_threshold=-45dB,areverse,silenceremove=start_periods=1:start_threshold=-45dB,areverse,loudnorm=I=-16:TP=-1.5',
                        '-b:a', '64k', dest], check=True)
        manifest['clips'][key] = dest_rel
        print('added', key)

json.dump(manifest, open(manifest_path, 'w'), indent=2, ensure_ascii=False)
print(len(manifest['clips']), 'clips in', manifest_path)
