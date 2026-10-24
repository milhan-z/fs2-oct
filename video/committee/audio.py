"""Sound for the committee guide: calm synth score that builds through the two parts, UI sounds on every tap and
screen change, the stamp hit, and the voice-over (reverb + ducking), all on the timeline of cues.json.
Usage: python video/committee/audio.py <vo_dir> <out.wav>      (needs numpy, scipy)
"""
import json
import sys
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 44100
vo_dir, out_path = sys.argv[1], sys.argv[2]
cues = json.load(open("video/committee/cues.json"))
V = {v["key"]: v for v in cues["voice"]}
HIT = cues["hits"]
DUR = cues["duration"]
N = int(DUR * SR)
rng = np.random.default_rng(16_28_10)


def at(k, i=0, d=0.0):
    return V[k]["t"] + V[k]["off"][i] + d


def end_of(k, d=0.0):
    return V[k]["t"] + V[k]["dur"] + d


def zeros():
    return np.zeros((N, 2))


def lp(x, fc, order=2):
    return sosfilt(butter(order, min(fc, SR / 2 - 100), "low", fs=SR, output="sos"), x)


def hp(x, fc, order=2):
    return sosfilt(butter(order, fc, "high", fs=SR, output="sos"), x)


def bp(x, lo, hi):
    return sosfilt(butter(2, [lo, min(hi, SR / 2 - 100)], "band", fs=SR, output="sos"), x)


def put(buf, sig, t0, gl=1.0, gr=1.0):
    i = int(t0 * SR)
    if i >= N or i + len(sig) <= 0:
        return
    a = max(0, -i)
    n = min(len(sig) - a, N - max(i, 0))
    buf[max(i, 0) : max(i, 0) + n, 0] += sig[a : a + n] * gl
    buf[max(i, 0) : max(i, 0) + n, 1] += sig[a : a + n] * gr


def saw(f, n, cents=0.0, phase=0.0):
    ph = (phase + np.cumsum(np.full(n, f * 2 ** (cents / 1200) / SR))) % 1.0
    return 2 * ph - 1


def env_exp(n, attack, tau):
    t = np.arange(n) / SR
    e = np.exp(-t / tau)
    a = int(attack * SR)
    if a > 0:
        e[:a] *= np.linspace(0, 1, a)
    return e


def midi(m):
    return 440.0 * 2 ** ((m - 69) / 12)


def noise(n):
    return rng.standard_normal(n)


def reverb_ir(seconds, tau, seed):
    r = np.random.default_rng(seed)
    n = int(seconds * SR)
    t = np.arange(n) / SR
    ir = r.standard_normal(n) * np.exp(-t / tau)
    ir[: int(0.012 * SR)] *= np.linspace(0, 1, int(0.012 * SR))
    return lp(ir, 5500) * 0.6


IR_L, IR_R = reverb_ir(2.4, 0.55, 1), reverb_ir(2.4, 0.55, 2)


def reverb(buf, wet):
    out = np.zeros_like(buf)
    out[:, 0] = fftconvolve(buf[:, 0], IR_L)[:N]
    out[:, 1] = fftconvolve(buf[:, 1], IR_R)[:N]
    return out * wet / (np.abs(out).max() + 1e-9) * np.abs(buf).max()


T_START = V["staff"]["t"] - 0.7
T_ADMIN = V["admin"]["t"]
T_END = HIT["outro"] - 0.15

# ---------------------------------------------------------------- music -----------------------
music = zeros()
BPM = 100
step = 60 / BPM / 2
bar_len = 8 * step
CHORDS = [
    (45, [57, 60, 64, 69, 72, 69, 64, 60]),
    (41, [53, 57, 60, 65, 69, 65, 60, 57]),
    (48, [60, 64, 67, 72, 76, 72, 67, 64]),
    (43, [55, 59, 62, 67, 71, 67, 62, 59]),
]
t = np.arange(N) / SR

# drone under everything, thin during the intro, fuller later; swells into the outro
drone = (np.sin(2 * np.pi * 55 * t) + 0.5 * np.sin(2 * np.pi * 55.4 * t) + 0.35 * lp(saw(55, N), 220)) * 0.4
drone *= np.clip(t / 2.5, 0, 1) * (0.5 + 0.5 * np.clip((t - T_START) / 8, 0, 1))
drone *= np.clip((DUR - t) / 1.6, 0, 1)
music[:, 0] += drone * 0.5
music[:, 1] += drone * 0.5

# heartbeat while the title lights up
for k in range(4):
    tt = 0.35 + k * 0.62
    for dt, gg in ((0, 1.0), (0.2, 0.7)):
        n = int(0.4 * SR)
        thump = np.sin(2 * np.pi * np.cumsum(62 * np.exp(-np.arange(n) / SR * 9)) / SR)
        put(music, thump * env_exp(n, 0.004, 0.09) * (0.45 + 0.1 * k) * gg * 0.8, tt + dt)

# arpeggio: opens up with each part
i = 0
tt = T_START
while tt < T_END:
    bar = int((tt - T_START) // bar_len)
    root, tones = CHORDS[bar % 4]
    note = tones[i % 8]
    i += 1
    n = int(0.34 * SR)
    part2 = tt >= T_ADMIN
    prog = np.clip((tt - T_START) / 40.0, 0, 1)
    cutoff = 480 + 2600 * prog + (500 if part2 else 0)
    f = midi(note)
    s = (saw(f, n, -8) + saw(f, n, 8) + saw(f, n, 0, 0.3)) / 3 + 0.5 * np.sin(2 * np.pi * f / 2 * np.arange(n) / SR)
    s = lp(s, cutoff) * env_exp(n, 0.003, 0.15)
    accent = 1.0 if (i - 1) % 8 in (0, 4) else 0.76
    fade_in = np.clip((tt - T_START) / 1.4, 0, 1)
    fade_out = np.clip((T_END + 0.3 - tt) / 0.6, 0, 1)
    pan = 0.5 + 0.25 * np.sin(i * 0.7)
    put(music, s * 0.42 * accent * fade_in * fade_out, tt, 1.15 - pan, 0.15 + pan)
    tt += step

# bass and a soft pad from the second chapter on
tt = V["booths"]["t"]
while tt < T_END:
    bar = int((tt - T_START) // bar_len)
    root, _ = CHORDS[bar % 4]
    n = int(0.5 * SR)
    f = midi(root - 12)
    b = lp(saw(f, n) * 0.6 + np.sin(2 * np.pi * f * np.arange(n) / SR), 260) * env_exp(n, 0.01, 0.28)
    put(music, b * 0.5 * np.clip((T_END + 0.2 - tt) / 0.5, 0, 1), tt)
    tt += step * 2
for b in range(int((T_END - V["scan"]["t"]) // bar_len) + 1):
    t0 = V["scan"]["t"] + b * bar_len
    bar = int((t0 - T_START) // bar_len)
    _, tones = CHORDS[bar % 4]
    n = int((bar_len + 0.8) * SR)
    pad = sum(saw(midi(m - 12), n, d) for m in tones[:4] for d in (-6, 6)) / 8
    e = np.clip(np.arange(n) / SR / 0.9, 0, 1) * np.clip((n / SR - np.arange(n) / SR) / 0.8, 0, 1)
    put(music, lp(pad, 1000) * e * 0.26, t0, 0.9, 1.0)

# a soft pulse under the admin part
tt = T_ADMIN
while tt < T_END:
    n = int(0.3 * SR)
    kick = np.sin(2 * np.pi * np.cumsum(55 * np.exp(-np.arange(n) / SR * 14) + 38) / SR) * env_exp(n, 0.002, 0.07)
    put(music, kick * 0.35, tt)
    tt += step * 2
    if tt > T_END:
        break

# riser into the stamp
n = int((HIT["stamp"] - 0.1 - HIT["tapConfirm"]) * SR)
tr = np.arange(n) / SR
put(music, (np.sin(2 * np.pi * np.cumsum(180 + 1000 * (tr / tr[-1]) ** 2) / SR) * 0.2 + bp(noise(n), 500, 7000) * (tr / tr[-1]) ** 2 * 0.45) * (tr / tr[-1]) ** 1.5, HIT["tapConfirm"])

# outro chord
n = int((DUR - HIT["outro"]) * SR)
to = np.arange(n) / SR
chord = sum(saw(midi(m), n, d) for m in (45, 57, 64, 69, 72, 76) for d in (-7, 7)) / 12
chord = lp(chord, 1500) * np.clip(to / 0.5, 0, 1) * np.exp(-to / 4.5) * np.clip((DUR - HIT["outro"] - to) / 1.2, 0, 1)
put(music, chord * 0.5, HIT["outro"], 0.9, 1.0)

# ---------------------------------------------------------------- impacts and ui ---------------
fx = zeros()


def boom(buf, t0, power=1.0, tail=2.2):
    n = int(tail * SR)
    sub = np.sin(2 * np.pi * np.cumsum(32 + 45 * np.exp(-np.arange(n) / SR * 5)) / SR) * env_exp(n, 0.002, 0.7 * power + 0.3)
    nb = int(0.35 * SR)
    put(buf, sub * 0.9 * power, t0)
    put(buf, lp(noise(nb), 700) * env_exp(nb, 0.001, 0.07) * 0.8 * power, t0)
    put(buf, hp(noise(int(0.06 * SR)), 2500) * env_exp(int(0.06 * SR), 0.0005, 0.015) * 0.5 * power, t0)


boom(fx, HIT["title"], 0.5, 1.6)
boom(fx, HIT["stamp"], 0.9)
boom(fx, HIT["outro"], 1.2, 3.0)
nrs = int(0.5 * SR)
put(fx, bp(noise(nrs), 300, 5000) * np.linspace(0, 1, nrs) ** 2 * 0.5, HIT["outro"] - 0.5)

sfx = zeros()


def tick(t0, g=1.0):
    n = int(0.09 * SR)
    s = (np.sin(2 * np.pi * 1700 * np.arange(n) / SR) * 0.4 + hp(noise(n), 3000) * 0.5) * env_exp(n, 0.0005, 0.014)
    put(sfx, s * 0.5 * g, t0)


def whoosh(t0, dur=0.3, g=0.2):
    n = int(dur * SR)
    put(sfx, bp(noise(n), 400, 5200) * np.sin(np.linspace(0, np.pi, n)) ** 2 * g, t0 - dur * 0.35, 0.9, 1.1)


def beep(t0, f=1320, g=0.2):
    n = int(0.22 * SR)
    put(sfx, (np.sin(2 * np.pi * f * np.arange(n) / SR) + 0.4 * np.sin(2 * np.pi * f * 1.5 * np.arange(n) / SR)) * env_exp(n, 0.003, 0.08) * g, t0)


taps = [V["staff"]["t"] + 3.1, at("booths", 1, -0.35), HIT["tapConfirm"], V["login"]["t"] + 1.35, V["review"]["t"] + 1.9, at("approve", 2, -0.7)]
for tp in taps:
    tick(tp)
# QR recognised by the scanner, and the confirm chime
beep(at("scan", 1, 0.45), 1320, 0.2)
beep(HIT["tapConfirm"] + 0.12, 988, 0.12)
beep(HIT["tapConfirm"] + 0.3, 1480, 0.12)
# screen changes
changes = [V["staff"]["t"] - 0.3, V["booths"]["t"] - 0.15, at("booths", 1, -0.1), at("scan", 1, 0.3), at("queue", 1, -0.2), V["states"]["t"] - 0.15, V["manual"]["t"] - 0.15, V["confirm"]["t"] - 0.2, V["history"]["t"] - 0.15, V["closed"]["t"] - 0.15,
           V["admin"]["t"] - 0.2, V["overview"]["t"] - 0.15, V["review"]["t"] - 0.15, at("review", 1, -0.5), at("approve", 2, -0.25), V["people"]["t"] - 0.15, V["content"]["t"] - 0.15, at("content", 2, -0.3), V["questions"]["t"] - 0.15, V["settings"]["t"] - 0.15, V["export"]["t"] - 0.15]
for c in changes:
    whoosh(c, 0.3, 0.16)
whoosh(V["staff"]["t"] - 0.7, 0.9, 0.35)
whoosh(V["admin"]["t"] - 0.7, 0.9, 0.35)
whoosh(V["admin"]["t"] - 0.9, 0.7, 0.3)
whoosh(HIT["tapConfirm"] + 0.1, 0.7, 0.25)
# bulbs crackling at the start
for t0 in sorted(rng.uniform(0.35, 2.0, 14)):
    n = int(rng.uniform(0.012, 0.05) * SR)
    put(sfx, hp(noise(n), 1500) * env_exp(n, 0.0005, 0.01) * rng.uniform(0.15, 0.4), t0, rng.uniform(0.5, 1.2), rng.uniform(0.5, 1.2))
n = int(2.4 * SR)
tb = np.arange(n) / SR
put(sfx, lp(saw(120, n), 900) * 0.07 * np.clip(tb / 0.4, 0, 1) * np.clip((2.4 - tb) / 0.4, 0, 1) * (rng.random(n // 400 + 1).repeat(400)[:n] > 0.08), 0.3)

# ---------------------------------------------------------------- voice ------------------------
voice = zeros()
vact = np.zeros(N)
for k, v in V.items():
    w = wave.open(f"{vo_dir}/{k}.wav")
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
    w.close()
    x = x / np.abs(x).max() * 0.9
    x = x + lp(x, 260) * 0.35
    put(voice, x, v["t"])
    a, b = int(v["t"] * SR), min(N, int((v["t"] + len(x) / SR) * SR))
    vact[a:b] = 1
vwet = reverb(voice, 0.28)
vwet = np.stack([lp(vwet[:, 0], 4200), lp(vwet[:, 1], 4200)], axis=1)
vwet = np.roll(vwet, int(0.03 * SR), axis=0)

att, rel = np.exp(-1 / (0.06 * SR)), np.exp(-1 / (0.45 * SR))
env = np.zeros(N)
cur = 0.0
for k in range(N):
    tgt = vact[k]
    cur = tgt + (cur - tgt) * (att if tgt > cur else rel)
    env[k] = cur
duck = 1 - 0.62 * env

mix = voice * 1.0 + vwet * 0.4 + (music * duck[:, None]) * 0.62 + fx * 0.5 + reverb(fx, 0.35) * 0.5 + sfx * 0.7
mix *= np.clip((DUR - np.arange(N) / SR) / 1.0, 0, 1)[:, None]
mix = mix / np.abs(mix).max() * 0.89
pcm = (np.clip(mix, -1, 1) * 32767).astype("<i2")
with wave.open(out_path, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", out_path, f"{DUR:.1f}s")
