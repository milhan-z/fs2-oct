"""Voice-over for the FS² tutorial (English, trailer-style narrator) with edge-tts neural voices.
Usage: python video/gen_vo.py <out_dir>   (needs: pip install edge-tts)
The script text is public copy only; it is sent to Microsoft's TTS service to be synthesised.
"""
import asyncio
import json
import sys

import edge_tts

VOICE = "en-US-ChristopherNeural"
RATE = "-2%"
PITCH = "-6Hz"

# spoken form: "F S squared", "N R P", "Q R" so the narrator spells them out
LINES = [
    ("hook", "Something strange is happening at F S squared."),
    ("signin", "One. Sign in, and take your photo."),
    ("map", "Two. Find each booth on the map."),
    ("qr", "Three. Show your Q R code. Get stamped."),
    ("notes", "Four. Write three notes per booth."),
    ("submit", "Then collect four stamps, give feedback, and submit."),
    ("outro", "F S squared. Stranger stories from the other side."),
]


async def main(out: str) -> None:
    for key, text in LINES:
        await edge_tts.Communicate(text, VOICE, rate=RATE, pitch=PITCH).save(f"{out}/{key}.mp3")
        print("ok", key)
    json.dump([{"key": k, "text": t} for k, t in LINES], open(f"{out}/lines.json", "w"), indent=1)


asyncio.run(main(sys.argv[1]))
