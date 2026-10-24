"""Sound for the FS² tutorial: original synth score (minor arpeggio, drone, heartbeat, riser, impacts),
UI sound effects and the dubbed voice-over on the same timeline as the picture (video/cues.json).
Usage: python video/audio.py <vo_dir> <out.wav>      (needs numpy, scipy)
"""
import json
import sys
import wave

import numpy as np
from scipy.signal import butter, fftconvolve, sosfilt

SR = 44100
vo_dir, out_path = sys.argv[1], sys.argv[2]
cues = json.load(open("video/cues.json"))
DUR = cues["duration"]  # reverb tails are mixed in before the final fade
N = int(DUR * SR)
HIT = cues["hits"]
rng = np.random.default_rng(26_10_28)  # seeded: the same file every run


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


def saw(f, n, detune_cents=0.0, phase=0.0):
    f2 = f * 2 ** (detune_cents / 1200)
    ph = (phase + np.cumsum(np.full(n, f2 / SR))) % 1.0
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


# ---------------------------------------------------------------- music ------------------------
music = zeros()
bar_len = 8 * (60 / 112 / 2)  # one bar of 8th notes at 112 BPM
step = 60 / 112 / 2
T_ARP0 = 3.4
T_ARP1 = 23.2
CHORDS = [  # (root, arpeggio tones)  Am – F – C – G
    (45, [57, 60, 64, 69, 72, 69, 64, 60]),
    (41, [53, 57, 60, 65, 69, 65, 60, 57]),
    (48, [60, 64, 67, 72, 76, 72, 67, 64]),
    (43, [55, 59, 62, 67, 71, 67, 62, 59]),
]

# drone
t = np.arange(N) / SR
drone = (np.sin(2 * np.pi * 55 * t) + 0.5 * np.sin(2 * np.pi * 55.4 * t) + 0.35 * lp(saw(55, N), 220)) * 0.4
drone *= np.clip(t / 2.5, 0, 1) * (0.55 + 0.45 * np.clip((t - 3) / 6, 0, 1))
drone *= 1 - 0.8 * ((t > 1.55) & (t < 1.72))  # power cut
tail_fade = np.clip((DUR - t) / 1.4, 0, 1)
drone *= tail_fade
music[:, 0] += drone * 0.55
music[:, 1] += drone * 0.55

# heartbeat while the lights flicker on
for k in range(5):
    tt = 0.35 + k * 0.62
    if tt > 3.3:
        break
    g = 0.5 + 0.12 * k
    for dt, gg in ((0, 1.0), (0.2, 0.7)):
        n = int(0.4 * SR)
        thump = np.sin(2 * np.pi * (62 * np.exp(-np.arange(n) / SR * 6)) * np.arange(n) / SR * 0 + 2 * np.pi * np.cumsum(62 * np.exp(-np.arange(n) / SR * 9) / SR))
        put(music, thump * env_exp(n, 0.004, 0.09) * g * gg * 0.8, tt + dt)

# arpeggio
ARP_MUTE = (HIT["stamp"] - 0.13, HIT["stamp"] + 0.06)
i = 0
tt = T_ARP0
while tt < T_ARP1:
    bar = int((tt - T_ARP0) // bar_len)
    root, tones = CHORDS[bar % 4]
    note = tones[i % 8]
    i += 1
    if ARP_MUTE[0] <= tt < ARP_MUTE[1]:
        tt += step
        continue
    n = int(0.34 * SR)
    prog = np.clip((tt - T_ARP0) / 14.0, 0, 1)
    after_hit = tt >= HIT["stamp"]
    cutoff = 520 + 3600 * prog ** 1.1 + (900 if after_hit else 0)
    f = midi(note)
    s = (saw(f, n, -8) + saw(f, n, 8) + saw(f, n, 0, 0.3)) / 3 + 0.5 * np.sin(2 * np.pi * f / 2 * np.arange(n) / SR)
    s = lp(s, cutoff) * env_exp(n, 0.003, 0.15)
    accent = 1.0 if (i - 1) % 8 in (0, 4) else 0.78
    fade_in = np.clip((tt - T_ARP0) / 1.2, 0, 1)
    fade_out = np.clip((T_ARP1 + 0.3 - tt) / 0.6, 0, 1)
    pan = 0.5 + 0.25 * np.sin(i * 0.7)
    put(music, s * 0.5 * accent * fade_in * fade_out, tt, 1.15 - pan, 0.15 + pan)
    tt += step

# bass and soft pulse
tt = 5.5
while tt < T_ARP1:
    bar = int((tt - T_ARP0) // bar_len)
    root, _ = CHORDS[bar % 4]
    n = int(0.5 * SR)
    f = midi(root - 12)
    b = lp(saw(f, n) * 0.6 + np.sin(2 * np.pi * f * np.arange(n) / SR), 260) * env_exp(n, 0.01, 0.28)
    amp = 0.55 + 0.25 * np.clip((tt - 8) / 8, 0, 1)
    put(music, b * amp * np.clip((T_ARP1 + 0.2 - tt) / 0.5, 0, 1), tt)
    tt += step * 2

# chord pad
for b in range(int((T_ARP1 - 7.5) // bar_len) + 1):
    t0 = 7.5 + b * bar_len
    bar = int((t0 - T_ARP0) // bar_len)
    _, tones = CHORDS[bar % 4]
    n = int((bar_len + 0.8) * SR)
    pad = sum(saw(midi(m - 12), n, d) for m in tones[:4] for d in (-6, 6)) / 8
    e = np.clip(np.arange(n) / SR / 0.9, 0, 1) * np.clip((n / SR - np.arange(n) / SR) / 0.8, 0, 1)
    put(music, lp(pad, 1100) * e * 0.34, t0, 0.9, 1.0)

# soft kick pulse + ticks after the stamp
tt = HIT["stamp"] + 0.12
while tt < 23.0:
    n = int(0.3 * SR)
    kick = np.sin(2 * np.pi * np.cumsum(55 * np.exp(-np.arange(n) / SR * 14) + 38) / SR) * env_exp(n, 0.002, 0.07)
    put(music, kick * 0.55, tt)
    tt += step * 2
tt = HIT["stamp"] + 0.12 + step / 2
while tt < 23.0:
    n = int(0.05 * SR)
    put(music, hp(noise(n), 6500) * env_exp(n, 0.001, 0.012) * 0.16, tt, 0.8, 1.1)
    tt += step

# riser into the stamp
n = int((HIT["stamp"] - 0.12 - 12.4) * SR)
tr = np.arange(n) / SR
sweep = np.sin(2 * np.pi * np.cumsum(180 + 1100 * (tr / tr[-1]) ** 2) / SR)
nz = bp(noise(n), 500, 7000) * (tr / tr[-1]) ** 2
put(music, (sweep * 0.25 + nz * 0.5) * (tr / tr[-1]) ** 1.5 * 0.9, 12.4)

# impacts (stamp, title, outro)
fx = zeros()


def boom(buf, t0, power=1.0, tail=2.2):
    n = int(tail * SR)
    f = 32 + 45 * np.exp(-np.arange(n) / SR * 5)
    sub = np.sin(2 * np.pi * np.cumsum(f) / SR) * env_exp(n, 0.002, 0.7 * power + 0.3)
    nb = int(0.35 * SR)
    thud = lp(noise(nb), 700) * env_exp(nb, 0.001, 0.07)
    crack = hp(noise(int(0.06 * SR)), 2500) * env_exp(int(0.06 * SR), 0.0005, 0.015)
    put(buf, sub * 0.9 * power, t0)
    put(buf, thud * 0.8 * power, t0)
    put(buf, crack * 0.5 * power, t0)


boom(fx, HIT["stamp"], 1.0)
boom(fx, HIT["title"], 0.55, 1.6)
boom(fx, HIT["outro"], 1.25, 3.0)
# reversed swell before the outro
nrs = int(0.5 * SR)
put(fx, bp(noise(nrs), 300, 5000) * np.linspace(0, 1, nrs) ** 2 * 0.5, HIT["outro"] - 0.5)

# outro chord (Am add9) + final fade
n = int((DUR - HIT["outro"]) * SR)
to = np.arange(n) / SR
chord = sum(saw(midi(m), n, d) for m in (45, 57, 64, 69, 72, 76) for d in (-7, 7)) / 12
chord = lp(chord, 1500) * np.clip(to / 0.5, 0, 1) * np.exp(-to / 4.5)
chord *= np.clip((DUR - HIT["outro"] - to) / 1.2, 0, 1)
put(music, chord * 0.55, HIT["outro"], 0.9, 1.0)

# ---------------------------------------------------------------- ui sfx -----------------------
sfx = zeros()


def tick(t0, g=1.0):
    n = int(0.09 * SR)
    s = (np.sin(2 * np.pi * 1700 * np.arange(n) / SR) * 0.4 + hp(noise(n), 3000) * 0.5) * env_exp(n, 0.0005, 0.014)
    put(sfx, s * 0.5 * g, t0)


def whoosh(t0, dur=0.35, g=0.4, up=True):
    n = int(dur * SR)
    x = bp(noise(n), 400, 5200)
    e = np.sin(np.linspace(0, np.pi, n)) ** 2
    put(sfx, x * e * g, t0 - dur * 0.35, 0.9, 1.1) if up else put(sfx, x[::-1] * e * g, t0 - dur * 0.35)


for tp in (5.15, 8.95, 10.45, 20.15, 21.85):
    tick(tp)
# camera shutter
n = int(0.12 * SR)
put(sfx, (hp(noise(n), 1800) * env_exp(n, 0.001, 0.02) + 0.5 * hp(noise(n), 900) * np.roll(env_exp(n, 0.001, 0.025), int(0.045 * SR))) * 0.55, 6.4)
# page changes
for tw in (4.5, 5.6, 7.5, 9.1, 10.7, 15.4, 17.1, 19.0, 20.3, 21.0, 22.1):
    whoosh(tw, 0.3, 0.2)
whoosh(3.25, 0.9, 0.45)
whoosh(22.9, 0.7, 0.4)
# typing on the notes page
for k, tt in enumerate(np.arange(16.1, 18.4, 0.09)):
    if rng.random() < 0.8:
        tick(tt, 0.35 + 0.15 * rng.random())
# scanner hum and beep
n = int(1.7 * SR)
ts = np.arange(n) / SR
scan = np.sin(2 * np.pi * np.cumsum(500 + 650 * ts / ts[-1]) / SR) * 0.07 * np.sin(np.pi * ts / ts[-1])
put(sfx, scan, 11.7)
n = int(0.28 * SR)
put(sfx, (np.sin(2 * np.pi * 1320 * np.arange(n) / SR) + 0.4 * np.sin(2 * np.pi * 1980 * np.arange(n) / SR)) * env_exp(n, 0.003, 0.09) * 0.22, 13.45)
# flickering bulbs: electric crackle and a buzz
for tt in sorted(rng.uniform(0.35, 2.1, 16)):
    n = int(rng.uniform(0.012, 0.05) * SR)
    put(sfx, hp(noise(n), 1500) * env_exp(n, 0.0005, 0.01) * rng.uniform(0.15, 0.4), tt, rng.uniform(0.5, 1.2), rng.uniform(0.5, 1.2))
n = int(2.6 * SR)
tb = np.arange(n) / SR
buzz = lp(saw(120, n), 900) * 0.07 * np.clip(tb / 0.4, 0, 1) * np.clip((2.6 - tb) / 0.4, 0, 1) * (rng.random(n // 400 + 1).repeat(400)[:n] > 0.08)
put(sfx, buzz, 0.3)
# status "sent" stamp
n = int(0.5 * SR)
put(sfx, lp(noise(n), 500) * env_exp(n, 0.001, 0.05) * 0.6, 22.1)

# ---------------------------------------------------------------- voice -------------------------
voice = zeros()
vact = np.zeros(N)
for v in cues["voice"]:
    w = wave.open(f"{vo_dir}/{v['key']}.wav")
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
    w.close()
    x = x / np.abs(x).max() * 0.9
    warm = lp(x, 260) * 0.35  # chest
    x = x + warm
    put(voice, x, v["t"])
    a, b = int(v["t"] * SR), int((v["t"] + len(x) / SR) * SR)
    vact[a:b] = 1
voice_wet = reverb(voice, 0.3)
voice_wet = np.stack([lp(voice_wet[:, 0], 4200), lp(voice_wet[:, 1], 4200)], axis=1)
voice_wet = np.roll(voice_wet, int(0.03 * SR), axis=0)

# ducking: music dips 9 dB under the voice (fast attack, slow release)
att, rel = np.exp(-1 / (0.06 * SR)), np.exp(-1 / (0.45 * SR))
env = np.zeros(N)
cur = 0.0
for k in range(N):
    tgt = vact[k]
    cur = tgt + (cur - tgt) * (att if tgt > cur else rel)
    env[k] = cur
duck = 1 - 0.62 * env

mus = music * duck[:, None]
fx_wet = reverb(fx, 0.35)
mix = voice * 1.0 + voice_wet * 0.42 + mus * 0.62 + fx * 0.55 + fx_wet * 0.5 + sfx * 0.7
mix *= np.clip((DUR - np.arange(N) / SR) / 0.9, 0, 1)[:, None]  # final fade
peak = np.abs(mix).max()
mix = mix / peak * 0.89
pcm = (np.clip(mix, -1, 1) * 32767).astype("<i2")
with wave.open(out_path, "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("wrote", out_path, f"{DUR:.1f}s")
