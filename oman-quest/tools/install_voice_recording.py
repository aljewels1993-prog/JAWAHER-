"""Cut one long recording of the hero's lines into clips and install them.

Usage: python3 -I tools/install_voice_recording.py <recording> <segments.json> <mapping.json> <lang>
  segments.json – phrase start/end times (from silence detection)
  mapping.json  – {"correct-1": [1], "correct-7": [7, 8], ...} phrase numbers per line
Writes public/voice/<lang>/<line>.mp3 and updates public/voice/manifest.json.
"""
import json, os, subprocess, sys

rec, seg_file, map_file, lang = sys.argv[1:5]
segs = {s['i']: s for s in json.load(open(seg_file))}
mapping = json.load(open(map_file))
here = os.path.dirname(os.path.abspath(__file__))
out = os.path.join(here, '..', 'public', 'voice')
os.makedirs(os.path.join(out, lang), exist_ok=True)
manifest_path = os.path.join(out, 'manifest.json')
manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {'version': 1, 'clips': {}}
CLEAN = ('silenceremove=start_periods=1:start_threshold=-42dB,areverse,'
         'silenceremove=start_periods=1:start_threshold=-42dB,areverse,'
         'afade=t=in:d=0.02,areverse,afade=t=in:d=0.04,areverse,loudnorm=I=-16:TP=-1.5:LRA=11')
for line, parts in mapping.items():
    start = segs[parts[0]]['start']
    end = segs[parts[-1]]['end']
    rel = f'{lang}/{line}.mp3'
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', rec, '-ss', f'{start:.3f}', '-to', f'{end:.3f}',
                    '-ac', '1', '-ar', '44100', '-af', CLEAN, '-b:a', '96k', os.path.join(out, rel)], check=True)
    manifest['clips'][f'{lang}/{line}'] = rel
json.dump(manifest, open(manifest_path, 'w'), indent=2, ensure_ascii=False)
print(len(mapping), 'clips installed;', len(manifest['clips']), 'in manifest')
