# AUDIT — UI & transitions (build 24 Oct 2026, mock mode)

**Method:** `node scripts/audit.mjs http://localhost:5173 before`. Playwright Chromium at 390×844 with `--use-fake-device-for-media-stream --use-fake-ui-for-media-stream`.
The flow covers Cover → Sign in → Photo → Onboarding → Map → Pop-up → QR → Stamp → Resume → Passport → Exit → Status.
- Video: `docs/audit/before/video/*.webm`.
- Static screens: `docs/audit/before/screens/`.
- Transition frames: `docs/audit/before/frames/tNN-*/` (filenames carry ms since the trigger). Frames come from screenshots, so the cadence is ±100 ms with some 150–250 ms gaps.
- Contact sheets: `docs/audit/before/sheet-tNN-*.png`.
- A1 was rerun with `getUserMedia` forced to reject (`A1_ONLY=1`), in mock and in Supabase mode (`docs/audit/before-supabase/`).

## Findings A1–A7
| # | Status | Evidence | Notes |
| --- | --- | --- | --- |
| A1 | **Partly confirmed** | `screens/a1-*.png`, `before-supabase/screens/a1-after-use.png` | When the camera is denied, the shutter turns into a "Take photo" button that opens the hidden `<input capture="user">`. The file **is saved** in both mock and Supabase. The UX is still bad: the red "Camera unavailable…" stays after a photo is chosen, and nothing visibly says "choose from your phone camera". The Supabase upload takes >3.5 s behind a spinner. Mock has no "Use sample photo". If the permission prompt is never answered, the shutter stays active and silently does nothing. "Could not save the photo" was **not reproduced**; possible causes are HEIC/very large files or a network error. |
| A2 | **Confirmed (partly improved)** | `sheet-t01` | The cover now rotates on its hinge, but the page behind it is a **stand-in** ("Identity page" + grey lines), not the live Sign-in page. It then morphs and Sign-in **fades in** over a dimmed frame (~1067–1300 ms). That still means two layers and a fade. |
| A3 | **Confirmed** | `sheet-t17`, `sheet-t18` | Opening `/passport` or `/qr` directly shows a dark screen with a centre spinner for ±130 ms in mock (longer on Supabase), and nothing is cached. |
| A4 | **Confirmed (different form)** | `sheet-t05` | After "Use this photo": a spinner on the button, then the polaroid flies to the top-left, then ±1.2 s of empty screen, then a black onboarding. The photo flies to a header that does not exist on the next screen. |
| A5 | **Confirmed (cause found)** | `screens/09-popup.png`, `log.json → notes.popupStamp` | The asset loads (`stamp-taiwan.webp`, natural 320 px). The code renders it at 96 px with `opacity .35 + grayscale` while the booth is unstamped, so it reads as a "faint circle". |
| A6 | **Confirmed** | `sheet-t06` frame ≥4.8 s | Onboarding pins are green/red/blue/yellow, while the map uses colour = status. |
| A7 | **Confirmed** | `screens/01-cover.png` | Cover bulbs are ±26×38 px with a 62 px halo. The halo is clipped flat at the bottom of the SVG viewBox, and the wire ends inside the screen. |

## Findings B1–B7 (generic "AI design")
| # | Status | Evidence |
| --- | --- | --- |
| B1 | **Confirmed** | After Sign in, only dark dashboards remain. Passport = 4 identical cards (`13-passport.png`). |
| B2 | **Confirmed** | `rounded-[18px]`/`rounded-2xl` + 1 px borders on visa rows, the requirements box, QR, status card, Guide, sheet (`rounded-t-[28px]`). Code count: Passport ×3, QR ×2, Booth/Map/Onboarding/Guide ×1. |
| B3 | **Confirmed** | `text-center` dominates QR (×4), Status (×4), Stamp (×3), Photo (×3). Almost every primary button is full-width. |
| B4 | **Confirmed** | `.kicker` appears on Photo ×2, Passport ×3, Status ×2, Booth sheet, Stamp, Onboarding, and the BackHeader of every page. |
| B5 | **Confirmed** | `btn-red-glow` on the cover. Glow on the QR button in the bottom nav, the QR frame (`shadow 0 0 40px` red), and the shutter. |
| B6 | **Confirmed** | Outline icons (map/passport/QR/sun/camera) in the nav and buttons. The floating QR circle with red glow is a template pattern. |
| B7 | **Confirmed** | The flower is pinned to the panel/screen edge. Onboarding vines are random lines. Backgrounds are plain radial gradients (`screen-bg`, `screen-bg-red`, `panel-red`, plus 8 inline). |

## Score per screen (1 = poor, 5 = matches DESIGN.md)
AD = matches the art direction · Typ = typographic hierarchy · AP = anti-pattern-free (5 = none) · Tr = transition continuity in/out.

| Screen | AD | Typ | AP | Tr | Elements that break the rules | Screenshot |
| --- | --- | --- | --- | --- | --- | --- |
| Cover | 4 | 4 | 3 | 3 | Button glow, plain radial background, oversized clipped bulbs (A7), flower stuck on the edge | `01-cover.png` |
| Sign in | 4 | 4 | 4 | 2 | Stand-in page + fade (A2). Large radius on the sheet (18 px). Paper has no noise/stitching/page number. | `02-signin.png`, `sheet-t01` |
| Create passport | 4 | 3 | 4 | 3 | Labels are not document-style. Ink-coloured "Continue" disabled state looks grey and dead. | `03-register.png` |
| Photo | 2 | 2 | 2 | 1 | Night material for a writing task. 2 eyebrows. Separate polaroid. Glowing shutter. Fallback hidden (A1). Fly to a non-existent header (A4). | `04-photo.png`, `sheet-t05` |
| Onboarding | 3 | 3 | 3 | 3 | Random pin colours (A6), random-line vines, card with border | `sheet-t06` |
| Map (Lounge) | 3 | 3 | 2 | 3 | Radial-gradient panel, flower sticker, 22 px border radius, teardrop pins drawn as an outline, Poppins 800 heading | `07-map.png` |
| Map (Building) | 3 | 2 | 3 | 4 | Hollow booth dots like "OO", crowded labels | `08-map-building.png` |
| Booth pop-up | 3 | 3 | 2 | 1 | Generic bottom sheet sliding from below (not from the pin). `rounded-t-[28px]`. Faint stamp (A5). Eyebrow. | `09-popup.png`, `sheet-t09` |
| QR | 2 | 3 | 1 | 1 | Glowing yellow frame + red glow, 26 px radius, centred layout, bordered status card. Slides in from the side, not from the QR button. | `10-qr.png`, `sheet-t11` |
| Stamp moment | 4 | 4 | 3 | 2 | Stamp lands well, but the lights are a separate set (not the header). 3 radial gradients. Centred. | `11-stamp.png`, `sheet-t12` |
| Resume (Visa) | 3 | 3 | 3 | 2 | Dark header + paper card with tape (good). The card is still a rounded box with a shadow. Generic slide transition. | `12-resume.png` |
| Passport | 1 | 2 | 1 | 2 | 4 identical cards + requirements box + outline button. Not a book. No MRZ or ghost image. Spinner on direct load (A3). | `13-passport.png`, `13b-passport-full.png` |
| Exit | 3 | 3 | 3 | 2 | Paper feedback box OK. Grey disabled button. Checklist is centred/generic. | `14-exit.png` |
| Status | 3 | 3 | 2 | 2 | Bordered card for the stamp, radial background, centred, cream button. The skyline is already right. | `15-status.png` |
| Bottom nav | — | — | 1 | — | Outline icons + red floating QR with glow (B6) | `07-map.png` |

### 3 worst screens
1. **Passport**: AD 1 · AP 1. A list of identical cards instead of a book. This is the screen shown at the exit gate.
2. **QR**: AP 1 · Tr 1. Glowing frame, centred, bordered card. It does not grow from the QR button.
3. **Photo**: AD 2 · Tr 1. Night material for an identity task, separate polaroid, broken fallback UX (A1), discontinuous fly animation (A4).

The booth pop-up is close behind (Tr 1: it does not grow from the pin, and the stamp is faint).
