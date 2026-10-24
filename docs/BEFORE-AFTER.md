# Before / After — UI & transition redesign

Screens at 390×844 (mock mode). `docs/audit/before/screens` = before the redesign, `docs/audit/after2/screens` = current build. Transitions are recorded frame by frame (every ~100 ms) with `node scripts/audit.mjs http://localhost:5173 <run>`; frames and videos are gitignored.

| Screen | Before | After | What changed |
|---|---|---|---|
| Cover | `before/screens/01-cover.png` | `after2/screens/01-cover.png` | Logos printed at the top; light wire runs past both screen edges; night scenery from the GSM kit (skyline, pines, clouds, smoke, red horizon glow, drifting spores, 7 Demogorgon flowers). One screen, no scroll. |
| Sign-in | `02-signin` | `02-signin` | Paper form page inside the book (unchanged content). |
| Photo | `04-photo` | `04-photo`, `05-photo-taken` | The photo box starts empty; a polaroid camera pops out of it, and on "Use this photo" the polaroid flies back and is pasted into the box. MRZ types out, then the photo saves. Camera-denied fallback (file input) and mock "Use sample photo" live inside the polaroid. |
| Map | `07-map` | `07-map` | Full-screen page (no book frame). Progress lights hang across the top of the back pocket; folded map unfolds; legend no longer covered by the pocket lip. "Next up" always names the next action, including "Write notes for …". |
| QR | `10-qr` | `10-qr` | Permit ticket grows from the QR tab. |
| Stamp → notes | `11-stamp`, `12-resume` | `11-stamp`, `12-resume` | Visa page is a pop-up sheet growing from what opened it; stamp moment + notes on the same page; close button returns to the page underneath. |
| Passport | `13-passport` (pager, "Go to Exit page") | `13-passport`, `13b-passport-full` | One full page: identity, 4 visa slots each with a clear next action ("Not stamped · visit the booth" / "Write notes · 1/3 →" / "Notes done ✓"), requirement checklist, "Answer & submit →" opens the exit pop-up. No next/prev slides. |
| Exit | `14-exit` | `14-exit` | Pop-up sheet over the passport; envelope animation on submit. |
| Status | `15-status` | `15-status` | Full page with ink status stamp. |

## Transitions
- Forward page turn: the current leaf lifts away on the **left** hinge.
- Back: the previous leaf comes back **from the left** over the current page (no right-hand swing). Left-edge swipe also goes back.
- Book frame only for cover, sign-in and photo; Map · QR · Passport are full-screen pages with the index tabs at the bottom.
- Pop-ups (visa, exit, QR, booth sticker, polaroid camera) grow from the element that opened them and shrink back into it.
- `prefers-reduced-motion`: all of the above become short fades.

## Checks (24 Oct 2026)
- `npm run build`, `tsc -b`, `eslint` clean.
- Mock flow (`scripts/audit.mjs`) passes end to end, incl. camera-denied fallback.
- Viewports 360×740 and 430×932: no overflow on the cover.
- Supabase e2e (`scripts/e2e-supabase.mjs`): all pass, stamp reaches the phone in ~1.7 s.
