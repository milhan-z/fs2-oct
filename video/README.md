# FS² tutorial video (30 s)

30-second "how to use the passport" film: English voice-over, Stranger Things mood, built from **real screens of the app**.

Output: `public/video/fs2-tutorial-vertical.mp4` (1080×1920, phones / WhatsApp / Stories) and `public/video/fs2-tutorial-wide.mp4` (1920×1080, projector / slides). Posters next to them.

## Storyboard (matches the voice-over)
| Time | Voice | Picture |
| --- | --- | --- |
| 0.0–3.3 | "Something strange is happening at F S squared." | Lights flicker on, power cut, **FS²** ignites in neon |
| 3.3–7.4 | "One. Sign in, and take your photo." | Cover → sign-in → polaroid camera |
| 7.4–10.6 | "Two. Find each booth on the map." | Booth map, pins pulse, tap a pin |
| 10.6–15.3 | "Three. Show your QR code. Get stamped." | QR permit, scanner sweep, **stamp hit** |
| 15.3–18.9 | "Four. Write three notes per booth." | Notes page fills in |
| 18.9–22.9 | "Then collect four stamps, give feedback, and submit." | Passport with 4 stamps → feedback → submitted |
| 23.4–29.8 | "F S squared. Stranger stories from the other side." | Title card, date, venue, partner logos |

## Files
- `capture.mjs` – drives the app (mock mode, `npm run dev`) and saves the screens + element rects to `shots/`.
- `index.html` – the film. Every frame is a pure function of time (`window.seek(t)`), seeded randomness only.
- `render.mjs` – seeks frame by frame with Playwright, pipes PNGs to ffmpeg.
- `gen_vo.py` – voice-over with edge-tts neural voice `en-US-ChristopherNeural` (script text goes to Microsoft's TTS service).
- `audio.py` – original synth score, UI sound effects, reverb, ducking and mix on the same timeline (`cues.json`).
- `cues.json` – voice start times and hit times shared by picture and sound.

## Re-render
```bash
npm run dev                          # app in mock mode on :5173
node video/capture.mjs               # fresh screens
python video/gen_vo.py vo            # voice lines (then trim silence, see below)
python video/audio.py vo mix.wav     # score + sfx + voice
FFMPEG=/path/to/ffmpeg node video/render.mjs video v out.mp4 mix.wav     # or `h` for 16:9
```
Voice files are trimmed with `silenceremove` (start and end) and converted to mono 44.1 kHz WAV before `audio.py`; loudness is normalised to −14 LUFS with `loudnorm`.

Changing the script? Update `LINES` in `gen_vo.py`, the start times in `cues.json`, and the `SCREENS` / `STEPS` / `TAPS` timings in `index.html`.

## Committee guide (`video/committee/`)
A longer film for the ID Volunteer S16 committee: booth staff scanning (sign-in, scanning, queue colours, manual entry, confirm, undo, session hours) followed by the admin console. English voice-over (`en-US-ChristopherNeural`), 1920×1080, about 1:45.
- `capture.mjs` – drives the app in mock mode with a fake camera (`camera_frames.py` builds a looping desk-with-QR video) and saves real screens + element rects to `shots/`. Run against a production build (`npm run build && npx vite preview --port 4173`): the dev server's React StrictMode starts the scanner twice and the camera never attaches.
- `voice.json` → `python video/gen_vo.py <dir> <ffmpeg> video/committee/voice.json` – phrase-by-phrase directed voice-over.
- `build_cues.py <dir>` – lays the lines on the timeline (`cues.json`); `audio.py <dir> <out.wav>` – score, UI sounds, voice, ducking.
- `index.html` – the film; render with `HTML=video/committee/index.html CUES=video/committee/cues.json RECTS=video/committee/shots/rects.json node video/render.mjs video h out.mp4 mix.wav`.
- Extra participant names in the demo are fictional. Personal photos live in `video/private/` (gitignored).

## Participant guide (`video/guide/`)
The complete walkthrough for participants (about 1:50, English voice-over `en-US-ChristopherNeural`, 1920×1080): sign-up with the NRP autofill, camera permission, the booth map (whole building, Lounge, Partnership), showing the QR, getting stamped, writing notes, feedback, submitting, the status page and how to claim Stamp4It.
- `capture.mjs` – drives the app in mock mode against a production build (`VITE_DATA_MODE=mock npm run build && npx vite preview --port 4173`, then `node video/guide/capture.mjs http://localhost:4173`) and saves the screens plus element rects to `shots/` (gitignored: they contain the personal photos from `video/private/`). It also approves the submission in the admin console to capture the Approved status.
- `voice.json` → `python video/gen_vo.py <dir> <ffmpeg> video/guide/voice.json` (needs `pip install edge-tts numpy scipy`).
- `build_cues.py <dir>` – lays the lines on the timeline and writes `cues.json`: screen changes, taps, highlights, captions and sound anchors, shared by picture, sound and renderer.
- `audio.py <dir> <out.wav>` – score, UI sounds, stamp hit, voice with ducking; normalise with `loudnorm=I=-14`.
- `index.html` – the film. Render: `HTML=video/guide/index.html CUES=video/guide/cues.json RECTS=video/guide/shots/rects.json FFMPEG=<ffmpeg> node video/render.mjs video h out.mp4 mix.wav`.
