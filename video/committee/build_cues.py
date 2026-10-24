"""Lays the voice-over lines on the timeline (gaps between lines, longer ones between chapters) and writes
video/committee/cues.json for the picture (index.html), the sound (audio.py) and the renderer.
Usage: python build_cues.py <voice_dir>      (voice_dir has durations.json from gen_vo.py)
"""
import json
import sys

d = json.load(open(f"{sys.argv[1]}/durations.json"))
dur, off = d["durations"], d["segment_offsets"]
order = ["intro", "staff", "booths", "scan", "queue", "states", "manual", "confirm", "history", "closed", "admin", "login", "overview", "review", "approve", "people", "content", "questions", "settings", "export", "outro"]
gap = {"staff": 1.3, "admin": 1.5, "outro": 0.9}
t = 1.6
voice = []
for k in order:
    if voice:
        t += gap.get(k, 0.55)
    voice.append({"key": k, "t": round(t, 2), "dur": dur[k], "off": off[k]})
    t += dur[k]
V = {v["key"]: v for v in voice}
cues = {
    "duration": round(t + 3.2, 2),
    "fps": 30,
    "voice": voice,
    # sound-effect anchors shared by picture and sound
    "hits": {
        "title": round(V["intro"]["t"] + 0.0, 2),
        "tapConfirm": round(V["confirm"]["t"] + 1.55, 2),
        "stamp": round(V["confirm"]["t"] + 2.45, 2),
        "outro": round(V["outro"]["t"] - 0.02, 2),
    },
}
json.dump(cues, open("video/committee/cues.json", "w"), indent=1)
print("duration", cues["duration"], "hits", cues["hits"])
for v in voice:
    print(f'{v["key"]:10s} {v["t"]:6.2f}-{v["t"]+v["dur"]:6.2f}')
