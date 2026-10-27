"""Lays the voice-over of the participant guide on the timeline and writes video/guide/cues.json: the voice starts,
the screen changes, taps, highlights and captions, and the sound anchors. The picture (index.html), the sound
(audio.py) and the renderer all read this one file, so they can never drift apart.
Usage: python build_cues.py <voice_dir>      (voice_dir has durations.json from gen_vo.py)
"""
import json
import sys

d = json.load(open(f"{sys.argv[1]}/durations.json"))
dur, off = d["durations"], d["segment_offsets"]
order = ["intro", "open", "nrp", "autofill", "pin", "camera", "map", "rooms", "sheet", "qr", "stamp", "notes", "passport", "feedback", "submit", "status", "approved", "claim", "outro"]
gap = {"open": 1.2, "map": 0.9, "sheet": 0.7, "notes": 0.75, "feedback": 0.75, "status": 0.7, "claim": 0.85, "outro": 0.9}
t = 1.6
voice = []
for k in order:
    if voice:
        t += gap.get(k, 0.55)
    voice.append({"key": k, "t": round(t, 2), "dur": dur[k], "off": off[k]})
    t += dur[k]
V = {v["key"]: v for v in voice}


def at(k, i=0, dd=0.0):
    return round(V[k]["t"] + V[k]["off"][i] + dd, 2)


def end_of(k, dd=0.0):
    return round(V[k]["t"] + V[k]["dur"] + dd, 2)


HIT = {
    "title": V["intro"]["t"],
    "stamp": at("stamp", 1, 0.62),
    "outro": round(V["outro"]["t"] - 0.02, 2),
}

# screen changes: [shot, time]
SHOTS = [
    ["pt01-cover", V["open"]["t"] - 0.3],
    ["pt02-nrp", V["nrp"]["t"] - 0.15],
    ["pt03-register", V["autofill"]["t"] - 0.15],
    ["pt04-primer", V["camera"]["t"] - 0.15],
    ["pt05-camera", at("camera", 0, 1.35)],
    ["pt06-shot", at("camera", 1, 1.35)],
    ["pt07-map-building", V["map"]["t"] - 0.15],
    ["pt08-map-lounge", at("rooms", 0, -0.05)],
    ["pt09-map-partnership", at("rooms", 1, 0.0)],
    ["pt07-map-building", at("rooms", 3, 1.15)],
    ["pt08-map-lounge", V["sheet"]["t"] - 0.15],
    ["pt10-sheet", at("sheet", 0, 0.75)],
    ["pt07-map-building", V["qr"]["t"] - 0.15],
    ["pt11-qr", at("qr", 1, 0.55)],
    ["pt12-stamp", HIT["stamp"]],
    ["pt13-notes-short", at("notes", 0, 1.3)],
    ["pt14-notes-ok", at("notes", 3, -0.15)],
    ["pt16-passport-progress", V["passport"]["t"] - 0.15],
    ["pt16b-passport-submit", V["feedback"]["t"] - 0.15],
    ["pt17-exit-scale", at("feedback", 0, 2.45)],
    ["pt18-exit-text", at("feedback", 2, -0.1)],
    ["pt19-status-wait", at("submit", 1, -0.1)],
    ["pt20-status-approved", V["approved"]["t"] - 0.15],
    ["pt15-passport", V["claim"]["t"] - 0.15],
    ["pt20-status-approved", at("claim", 4, -0.3)],
]
# taps: [shot, time, rect]  (the finger arrives 0.45 s before the time)
TAPS = [
    ["pt01-cover", at("open", 1, 1.0), "openPassport"],
    ["pt02-nrp", at("nrp", 1, 0.85), "continue"],
    ["pt03-register", at("pin", 1, 0.95), "createPassport"],
    ["pt04-primer", at("camera", 0, 1.0), "primerContinue"],
    ["pt05-camera", at("camera", 1, 1.0), "shutter"],
    ["pt06-shot", at("camera", 2, 1.1), "usePhoto"],
    ["pt07-map-building", at("rooms", 0, -0.55), "tabLounge"],
    ["pt08-map-lounge", at("rooms", 1, -0.5), "tabPartnership"],
    ["pt09-map-partnership", at("rooms", 3, 1.0), "backBtn"],
    ["pt08-map-lounge", at("sheet", 0, 0.5), "pinKorea"],
    ["pt07-map-building", at("qr", 1, 0.2), "tabQR"],
    ["pt12-stamp", at("notes", 0, 0.65), "writeNow"],
    ["pt16b-passport-submit", at("feedback", 0, 2.05), "answerSubmit"],
    ["pt18-exit-text", at("submit", 0, 0.8), "submit"],
]
# highlights: [shot, t0, t1, rect, pad, kind]
HL = [
    ["pt01-cover", V["open"]["t"] + 0.5, at("open", 1, 1.0), "openPassport", 5, ""],
    ["pt02-nrp", V["nrp"]["t"] + 0.1, at("nrp", 1, 0.0), "nrp", 5, ""],
    ["pt02-nrp", at("nrp", 1, 0.0), at("nrp", 1, 0.85), "continue", 5, ""],
    ["pt03-register", V["autofill"]["t"] + 0.1, at("autofill", 2, 0.0), "regDept", 5, "g"],
    ["pt03-register", V["autofill"]["t"] + 0.1, at("autofill", 2, 0.0), "regYear", 5, "g"],
    ["pt03-register", at("autofill", 2, 0.0), end_of("autofill", 0.2), "regDept", 5, ""],
    ["pt03-register", at("autofill", 2, 0.0), end_of("autofill", 0.2), "regYear", 5, ""],
    ["pt03-register", V["pin"]["t"] + 0.1, at("pin", 1, 0.0), "regPin", 5, ""],
    ["pt03-register", V["pin"]["t"] + 0.1, at("pin", 1, 0.0), "regPin2", 5, ""],
    ["pt03-register", at("pin", 1, 0.0), at("pin", 1, 0.95), "createPassport", 5, ""],
    ["pt04-primer", V["camera"]["t"] + 0.1, at("camera", 0, 1.0), "primerContinue", 5, ""],
    ["pt05-camera", at("camera", 1, 0.0), at("camera", 1, 1.0), "shutter", 6, ""],
    ["pt06-shot", at("camera", 2, 0.2), at("camera", 2, 1.1), "usePhoto", 5, "g"],
    ["pt07-map-building", V["map"]["t"] + 0.1, at("map", 1, 0.0), "mapArea", 4, ""],
    ["pt07-map-building", at("map", 1, 0.0), at("map", 2, 0.0), "tabBuilding", 4, ""],
    ["pt07-map-building", at("map", 2, 0.0), end_of("map", 0.4), "legend", 4, ""],
    ["pt07-map-building", at("rooms", 0, -0.9), at("rooms", 0, -0.55), "tabLounge", 4, ""],
    ["pt08-map-lounge", at("rooms", 0, 0.2), at("rooms", 1, -0.5), "tabLounge", 4, ""],
    ["pt09-map-partnership", at("rooms", 1, 0.2), at("rooms", 2, 0.0), "tabPartnership", 4, ""],
    ["pt09-map-partnership", at("rooms", 3, 0.0), at("rooms", 3, 1.0), "backBtn", 5, "g"],
    ["pt08-map-lounge", V["sheet"]["t"] + 0.0, at("sheet", 0, 0.5), "pinKorea", 8, ""],
    ["pt10-sheet", at("sheet", 0, 0.9), end_of("sheet", 0.5), "showQr", 5, ""],
    ["pt07-map-building", V["qr"]["t"] + 0.0, at("qr", 1, 0.2), "tabQR", 5, ""],
    ["pt11-qr", at("qr", 2, 0.0), end_of("qr", 0.6), "qrCode", 6, "g"],
    ["pt12-stamp", HIT["stamp"] + 0.4, V["notes"]["t"] + 0.2, "writeNow", 5, ""],
    ["pt12-stamp", V["notes"]["t"] + 0.2, at("notes", 0, 0.65), "writeNow", 5, ""],
    ["pt13-notes-short", at("notes", 0, 1.35), at("notes", 1, 0.0), "notePoint1", 5, ""],
    ["pt13-notes-short", at("notes", 1, 0.0), at("notes", 2, 0.0), "noteCount1", 6, "y"],
    ["pt13-notes-short", at("notes", 2, 0.0), at("notes", 3, -0.2), "noteWarn", 6, "y"],
    ["pt14-notes-ok", at("notes", 3, -0.05), end_of("notes", 0.6), "notesTitle", 6, "g"],
    ["pt16-passport-progress", V["passport"]["t"] + 0.1, at("passport", 1, 0.0), "visasHead", 5, ""],
    ["pt16-passport-progress", at("passport", 1, 0.0), at("passport", 2, 0.0), "visas", 4, "g"],
    ["pt16b-passport-submit", at("feedback", 0, 0.0), at("feedback", 0, 2.05), "answerSubmit", 5, ""],
    ["pt17-exit-scale", at("feedback", 1, 0.0), at("feedback", 2, -0.2), "scale", 6, ""],
    ["pt18-exit-text", at("submit", 0, 0.0), at("submit", 0, 0.8), "submit", 5, ""],
    ["pt19-status-wait", at("status", 1, 0.0), at("status", 2, -0.2), "statusStamp", 8, ""],
    ["pt20-status-approved", V["approved"]["t"] + 0.2, end_of("approved", 0.3), "statusStampOk", 8, "g"],
    ["pt15-passport", at("claim", 1, 0.5), at("claim", 2, 0.0), "passPhoto", 6, ""],
    ["pt15-passport", at("claim", 2, 0.0), at("claim", 3, 0.0), "passNrp", 8, "g"],
    ["pt15-passport", at("claim", 3, 0.0), at("claim", 4, -0.3), "passName", 6, ""],
    ["pt20-status-approved", at("claim", 4, -0.2), end_of("claim", 0.2), "statusStampOk", 8, "g"],
]
# caption steps: [chapter, number, title, sub]
STEPS = [
    ["open", "01", "Open your passport", "Tap Open Passport"],
    ["nrp", "02", "Enter your NRP", "Then tap Continue"],
    ["autofill", "03", "Department & class year", "Filled in from your NRP · change them if needed"],
    ["pin", "04", "Choose a 4-digit PIN", "You will use it to sign in again"],
    ["camera", "05", "Allow the camera", "One portrait for your passport"],
    ["map", "06", "The booth map", "Every red circle is a booth"],
    ["rooms", "07", "Lounge & Partnership", "3 booths in the Lounge · 2 in the Partnership room"],
    ["sheet", "08", "Meet the speaker", "Tap a pin"],
    ["qr", "09", "Show your QR", "At the booth, open the QR tab"],
    ["stamp", "10", "Get stamped", "The officer confirms · the stamp lands on your phone"],
    ["notes", "11", "Write 3 notes", "At least 5 words each · saves by itself"],
    ["passport", "12", "Collect 4 stamps", "Any 4 booths · 4 sets of notes"],
    ["feedback", "13", "Give feedback", "Answer & submit · rate 1 to 5"],
    ["submit", "14", "Submit", "Your passport goes to the committee"],
    ["status", "15", "Check your status", "Awaiting review · needs revision · approved"],
    ["approved", "16", "Approved", "The stamp turns green"],
    ["claim", "17", "Claim your Stamp4It", "Show your Passport page and the Approved status"],
]
nxt = {STEPS[i][0]: (STEPS[i + 1][0] if i + 1 < len(STEPS) else "outro") for i in range(len(STEPS))}
steps = []
for key, n, title, sub in STEPS:
    t0 = V[key]["t"] - 0.1
    t1 = (HIT["outro"] - 0.7) if nxt[key] == "outro" else V[nxt[key]]["t"] - 0.1
    steps.append({"n": n, "title": title, "sub": sub, "t0": round(t0, 2), "t1": round(t1, 2)})

cues = {
    "duration": round(V["outro"]["t"] + V["outro"]["dur"] + 3.4, 2),
    "fps": 30,
    "voice": voice,
    "hits": HIT,
    "phoneIn": round(V["open"]["t"] - 0.8, 2),
    "phoneOut": round(HIT["outro"] - 0.9, 2),
    "shots": SHOTS,
    "taps": TAPS,
    "hl": HL,
    "steps": steps,
    "beeps": [[at("qr", 2, 0.35), 1320, 0.16], [HIT["stamp"] + 0.12, 988, 0.12], [HIT["stamp"] + 0.3, 1480, 0.12], [at("approved", 1, 0.3), 1175, 0.12], [at("approved", 1, 0.5), 1568, 0.12]],
}
json.dump(cues, open("video/guide/cues.json", "w"), indent=1)
print("duration", cues["duration"], "hits", HIT)
for v in voice:
    print(f'{v["key"]:10s} {v["t"]:6.2f}-{v["t"] + v["dur"]:6.2f}')
