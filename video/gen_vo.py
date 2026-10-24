"""Voice-over for the FS² tutorial: English, trailer-style narrator, directed phrase by phrase.

A single flat read sounds like a screen reader, so every line is split into phrases that each get their
own pace / pitch / loudness (low and slow for the mystery, punchy for the call-to-action), with short
hand-timed pauses between them. Voice: en-US-AndrewNeural (the most dynamic deep US voice we measured).

Usage: python video/gen_vo.py <out_dir> <ffmpeg>     (needs: pip install edge-tts numpy)
The script text is public copy only; it is sent to Microsoft's TTS service to be synthesised.
Writes <out_dir>/<key>.wav (mono 44.1 kHz, trimmed) and <out_dir>/durations.json.
"""
import asyncio
import json
import subprocess
import sys
import wave

import edge_tts
import numpy as np

VOICE = "en-US-AndrewNeural"
SR = 44100

# (text, rate, pitch, volume, pause_after_seconds)
LINES = {
    "hook": [
        ("Something strange...", "-14%", "-10Hz", "+0%", 0.24),
        ("is happening at", "-8%", "-6Hz", "+0%", 0.14),
        ("F S squared.", "-16%", "-10Hz", "+10%", 0),
    ],
    "signin": [
        ("One.", "-12%", "+0Hz", "+12%", 0.26),
        ("Sign in,", "+4%", "+2Hz", "+0%", 0.1),
        ("and take your photo.", "+6%", "+3Hz", "+0%", 0),
    ],
    "map": [
        ("Two.", "-12%", "+0Hz", "+12%", 0.26),
        ("Find each booth", "+4%", "+2Hz", "+0%", 0.08),
        ("on the map.", "+2%", "+0Hz", "+0%", 0),
    ],
    "qr": [
        ("Three.", "-12%", "+0Hz", "+12%", 0.26),
        ("Show your Q R code.", "+4%", "+2Hz", "+0%", 0.38),
        ("Get stamped!", "+0%", "+5Hz", "+20%", 0),
    ],
    "notes": [
        ("Four.", "-12%", "+0Hz", "+12%", 0.26),
        ("Write three notes", "+4%", "+2Hz", "+0%", 0.08),
        ("per booth.", "+2%", "+0Hz", "+0%", 0),
    ],
    "submit": [
        ("Then collect four stamps,", "+6%", "+2Hz", "+0%", 0.14),
        ("give feedback,", "+8%", "+4Hz", "+0%", 0.14),
        ("and submit!", "+6%", "+6Hz", "+15%", 0),
    ],
    "outro": [
        ("F S squared.", "-18%", "-12Hz", "+10%", 0.5),
        ("Stranger stories", "-10%", "-6Hz", "+0%", 0.1),
        ("from the other side.", "-14%", "-9Hz", "+5%", 0),
    ],
}


def decode(ffmpeg: str, mp3: str) -> np.ndarray:
    wav = mp3 + ".wav"
    subprocess.run([ffmpeg, "-y", "-loglevel", "error", "-i", mp3, "-ar", str(SR), "-ac", "1", wav], check=True)
    w = wave.open(wav)
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
    w.close()
    return x


def trim(x: np.ndarray, thr: float = 0.012) -> np.ndarray:
    idx = np.where(np.abs(x) > thr)[0]
    if not len(idx):
        return x
    a, b = max(0, idx[0] - int(0.01 * SR)), min(len(x), idx[-1] + int(0.04 * SR))
    return x[a:b]


async def main(out: str, ffmpeg: str) -> None:
    durations = {}
    offsets = {}
    for key, segs in LINES.items():
        parts = []
        offs = []
        pos = 0.0
        for i, (text, rate, pitch, vol, pause) in enumerate(segs):
            mp3 = f"{out}/{key}-{i}.mp3"
            await edge_tts.Communicate(text, VOICE, rate=rate, pitch=pitch, volume=vol).save(mp3)
            x = trim(decode(ffmpeg, mp3))
            offs.append(round(pos, 2))
            parts.append(x)
            pos += len(x) / SR
            if pause:
                parts.append(np.zeros(int(pause * SR)))
                pos += pause
        y = np.concatenate(parts)
        # soft fade at the line ends so the cuts never click
        f = int(0.012 * SR)
        y[:f] *= np.linspace(0, 1, f)
        y[-f:] *= np.linspace(1, 0, f)
        pcm = (np.clip(y, -1, 1) * 32767).astype("<i2")
        with wave.open(f"{out}/{key}.wav", "wb") as w:
            w.setnchannels(1)
            w.setsampwidth(2)
            w.setframerate(SR)
            w.writeframes(pcm.tobytes())
        durations[key] = round(len(y) / SR, 2)
        offsets[key] = offs
        print(key, durations[key], offs)
    json.dump({"durations": durations, "segment_offsets": offsets}, open(f"{out}/durations.json", "w"), indent=1)


asyncio.run(main(sys.argv[1], sys.argv[2]))
