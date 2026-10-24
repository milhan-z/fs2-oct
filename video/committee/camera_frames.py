"""Builds the looping fake-camera video (y4m) for the staff scanner: a desk, then a phone showing a QR.
Usage: python camera_frames.py <participant-qr.png> <junk-qr.png> <out.y4m> <ffmpeg>
Loop (30 s): 0-6 desk | 6-10 participant QR | 10-16 desk | 16-19.5 participant QR | 19.5-23 non-FS2 QR | 23-30 desk
"""
import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFilter

aud, junk, out, ff = sys.argv[1:5]
W, H = 640, 480


def desk():
    im = Image.new("RGB", (W, H))
    px = im.load()
    for y in range(H):
        for x in range(W):
            t = x / W * 0.6 + y / H * 0.4
            px[x, y] = (int(34 + 28 * t), int(36 + 22 * t), int(42 + 6 * t))
    d = ImageDraw.Draw(im)
    for i in range(6):
        d.rectangle([0, 60 + i * 70, W, 62 + i * 70], fill=(48, 50, 56))
    return im.filter(ImageFilter.GaussianBlur(1.2))


def with_phone(qr_path):
    im = desk().convert("RGBA")
    # a phone held in front of the camera, its screen showing the QR on a white card
    ph = Image.new("RGBA", (360, 420), (0, 0, 0, 0))
    d = ImageDraw.Draw(ph)
    d.rounded_rectangle([0, 0, 359, 419], radius=34, fill=(18, 18, 22, 255), outline=(70, 70, 78, 255), width=3)
    d.rounded_rectangle([14, 14, 345, 405], radius=24, fill=(247, 243, 234, 255))
    q = Image.open(qr_path).convert("RGB").resize((290, 290), Image.NEAREST)
    ph.paste(q, (35, 62))
    ph = ph.rotate(-2.5, expand=True, resample=Image.BICUBIC)
    im.alpha_composite(ph, ((W - ph.width) // 2, (H - ph.height) // 2 + 6))
    return im.convert("RGB")


tmp = tempfile.mkdtemp()
frames = {"desk": desk(), "aud": with_phone(aud), "junk": with_phone(junk)}
for k, v in frames.items():
    v.save(os.path.join(tmp, k + ".png"))
seq = [("desk", 6), ("aud", 4), ("desk", 6), ("aud", 3.5), ("junk", 3.5), ("desk", 7)]


def p(k):
    return os.path.join(tmp, k + ".png").replace(chr(92), "/")


with open(os.path.join(tmp, "list.txt"), "w") as f:
    for k, dur in seq:
        f.write(f"file '{p(k)}'\nduration {dur}\n")
    f.write(f"file '{p('desk')}'\n")
subprocess.run([ff, "-y", "-loglevel", "error", "-f", "concat", "-safe", "0", "-i", os.path.join(tmp, "list.txt"), "-vf", "fps=10,format=yuv420p", "-r", "10", out], check=True)
print("wrote", out)
