"""
Frames each preset's recording on its own action, for the studio's effect cards.

capture-media.mjs records every preset on the whole replica table, so every
thumbnail showed the same table. This finds where each animation actually
moves (each frame compared with the one just before it), crops the clip and
poster to that region at 16:9, and picks as poster the frame with the most
motion, so the card shows the effect in flight rather than the table at rest.

  python3 scripts/frame-media.py [preset-id ...]

Reads .capture/<id>/f*.jpg and .capture/results.json; writes public/media/<id>.webm
and .webp. Needs numpy, Pillow and ffmpeg (libvpx-vp9, libwebp).
"""
import json, subprocess, sys
from pathlib import Path

import numpy as np
from PIL import Image

WORK, OUT, FPS = Path('.capture'), Path('public/media'), 30


def grey(path, scale=4):
    image = Image.open(path).convert('L')
    return np.asarray(image.resize((image.width // scale, image.height // scale), Image.BILINEAR), dtype=np.int16)


def frame(preset):
    folder = WORK / preset['id']
    files = sorted(folder.glob('f*.jpg'))[: preset['frames']]
    scale = 4
    previous = grey(files[0])
    width, height = Image.open(files[0]).size
    union = np.zeros_like(previous, dtype=bool)
    energy = []
    end = preset['finishedAt'] if preset['finishedAt'] > 0 else len(files)
    for index, path in enumerate(files):
        current = grey(path)
        moved = np.abs(current - previous) > 26
        previous = current
        # Ignore specks (drifting light motes): keep rows and columns with real change.
        rows, cols = moved.sum(1) >= 3, moved.sum(0) >= 3
        moved &= rows[:, None] & cols[None, :]
        # The poster comes from the heart of the effect, not its first or last frames.
        energy.append(int(moved.sum()) if 0.15 * end <= index <= 0.9 * end else -1)
        union |= moved
    ys, xs = np.nonzero(union)
    if len(xs) == 0:
        box = (0, 0, width, height)
    else:
        x0, x1 = xs.min() * scale, (xs.max() + 1) * scale
        y0, y1 = ys.min() * scale, (ys.max() + 1) * scale
        # Pad, then grow to 16:9 around the centre, never smaller than 45% of the frame.
        pad = 0.08 * max(x1 - x0, (y1 - y0) * 16 / 9)
        w = max(x1 - x0 + 2 * pad, (y1 - y0 + 2 * pad) * 16 / 9, width * 0.45)
        w = min(w, width)
        h = w * 9 / 16
        if h > height:
            h, w = height, height * 16 / 9
        cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
        left = min(max(0, cx - w / 2), width - w)
        top = min(max(0, cy - h / 2), height - h)
        box = (int(left) // 2 * 2, int(top) // 2 * 2, int(w) // 2 * 2, int(h) // 2 * 2)
    poster = int(np.argmax(energy))
    x, y, w, h = box
    crop = f'crop={w}:{h}:{x}:{y}'
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-framerate', str(FPS), '-i', str(folder / 'f%04d.jpg'), '-frames:v', str(len(files)),
                    '-vf', f'{crop},scale=480:270:flags=lanczos,format=yuv420p', '-c:v', 'libvpx-vp9', '-crf', '36', '-b:v', '0', '-row-mt', '1',
                    '-deadline', 'good', '-cpu-used', '2', '-an', str(OUT / f"{preset['id']}.webm")], check=True)
    subprocess.run(['ffmpeg', '-loglevel', 'error', '-y', '-i', str(files[poster]), '-vf', f'{crop},scale=480:270:flags=lanczos', '-quality', '80',
                    str(OUT / f"{preset['id']}.webp")], check=True)
    return {'id': preset['id'], 'box': box, 'poster': poster}


if __name__ == '__main__':
    results = json.loads((WORK / 'results.json').read_text())
    wanted = set(sys.argv[1:])
    for preset in results:
        if not wanted or preset['id'] in wanted:
            print(frame(preset))
