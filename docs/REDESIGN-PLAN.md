# REDESIGN-PLAN — visuals & transitions only

Source: `docs/DESIGN.md` (contract), `docs/AUDIT.md` (baseline scores), `docs/MOTION.md`.
**Frozen:** every text string, the English copy, flow order, form fields, booth pop-up content, data, logic, backend.
Where a choice depends on an optional suggestion E1–E6, it is marked **[if E#]**. Without approval the default column applies.

---

## 0. Architecture: the Booklet

### 0.1 Components
- **`Booklet`** (`src/booklet/Booklet.tsx`) is mounted once inside `ParticipantLayout` and wraps every participant route except `/onboarding` (a full-screen Night moment).
  - Physical book on the Night material: width `min(100vw − 12px, 418px)`, height `100dvh − 12px`.
  - Cover-cloth spine on the left (6 px, `--color-cover`).
  - Page edge stack on the right, 3 layers offset 1.5 px (`PageStack`).
  - The current route is rendered **as the right-hand page**. The book itself never unmounts.
- **Route order** decides the page-turn direction:
  `/` 0 · `/signin` 1 · `/photo` 2 · `/map` 3 · `/passport` 4 · `/visa/:id` 5 · `/exit` 6 · `/status` 7.
  A higher index turns forward (the sheet rotates −180° on its left hinge). A lower index turns back.
- **Page turn** (`PageTurn`): the outgoing sheet is a snapshot of the old route (`useOutlet` frozen).
  - Motion: `rotateY 0 → −180°`, origin left, perspective 1400 px, 520 ms `--ease-page`.
  - Lighting: a fold-shadow gradient overlay (opacity 0 → .35 → 0) on the turning sheet, and a cast shadow on the page below.
  - The new route is already rendered underneath and interactive. No fade, no two pages side by side.
  - Interruptible: a new navigation mid-turn reverses from the current angle.
  - Drag: a horizontal pan on the page edge (right 24 px) drives `rotateY` with a MotionValue. On release `velocity.x` is passed to the spring (`stiffness 260, damping 30`) to finish or cancel. Back-swipe from the left edge works the same way.
- **Overlays that grow from an element** use shared `layoutId` inside the Booklet's `LayoutGroup`:
  - pin → visa sticker (pop-up)
  - QR tab → permit ticket (QR)
  - photo box ↔ header photo (`attendance-photo`)
- **Loading:** no full-screen spinner. Each page has a `skeleton` variant (rules, photo box, labels in ink 15%). The last `MyState` is cached in `localStorage` (`fs2.cache.state.<pid>`) and rendered instantly, then refreshed.
- **Reduced motion:** page turn, grow and stamp are replaced by a 120 ms crossfade. Drag-to-turn is disabled and navigation still works.

### 0.2 Reusable pieces (`src/booklet/`)

| Component | Real-object detail | Notes |
| --- | --- | --- |
| `PaperPage` | Cream `--color-paper` + paper noise (SVG feTurbulence, 6%) + `Guilloche` + page number bottom-right (Courier 11) + serial top-right "No. FS2-0028" (Courier 11) | Radius 3 px. Props: `number`, `serial`, `variant="identity|visa|form"` |
| `Guilloche` | SVG of 2 interlaced rosette curves + 1 wave band, ink-blue at 7% opacity | Generated once and inlined as a data-URI background |
| `PageStack` | 3 offset page edges on the right, 1 px lines in `--color-paper-edge` | Thickens slightly as stamps increase (decorative) |
| `Stitch` | Dashed thread line along the spine, 2 px dashes, ink 25% | Visible only on spreads (Passport) |
| `MRZ` | 2 Courier Prime lines `P<FS2<<NAME<<…` padded with `<`; optional per-character typewriter reveal | `aria-hidden`; the data is shown elsewhere in readable form |
| `InkStamp` | Stamp PNG/SVG with `mask-image` noise (uneven ink), opacity .88, rotation from a booth-seeded random in −12…+8° | Used for visa stamps, map pins (small), status stamp |
| `TicketPaper` | `--color-ticket`, perforation row of 10 px holes on top (radial mask), serial number, stub line | QR permit |
| `VisaSticker` | Rectangle, 2 px radius, faint country pattern (stamp at 6% scale-tiled), 1.5° tilt, lift shadow | Booth pop-up |

### 0.3 Global anti-patterns removed
`rounded-2xl/3xl` and 14–28 px radii are gone. Also removed:
- `btn-red-glow` and every `shadow-[0_0_…]` glow on buttons, QR and the shutter
- radial-gradient screen backgrounds (`screen-bg`, `screen-bg-red`, `panel-red`) → replaced by Night with noise plus one red light source from below
- `.kicker` on every page → at most one, and only for printed document headers
- full-width centred stacks → left-aligned text, a primary button sized to its content or full width only at the page foot
- outline icons in the nav → custom ink icons
- the floating red QR circle

---

## 1. Type & spacing (applies everywhere)
- Body text: Poppins 400 **15 px** / 22.
- Page titles: Libre Baskerville Bold **34 px** / 38 (2.27× body), left-aligned, ink `--color-ink`.
- Section titles on paper: Libre Baskerville Bold 20 px.
- Field labels: Poppins 600 **10.5 px**, uppercase, letter-spacing .08em, ink 70%.
- Document data: Courier Prime 14–15 px (NRP masked, serials, MRZ, stamp time).
- Anton: only inside `InkStamp` and the ticket ("ADMITTED"-style booth codes such as `B2`).
- Spacing scale 4/8/12/20/32/48. Inside a group 8–12, between groups 32 or more.
- Primary button: height 48, radius 6, `--color-stamp` red fill, ink-white text `#FBF3EA`, no shadow. Press feedback `scale(.98)` within 60 ms.
- Secondary: text or 1 px ink outline.

---

## 2. Screens (top → bottom; text unchanged)

### 2.1 Cover `/` (page 0)
- **Material:** Night (book closed) + Cover.
- **Layout:**
  - Light string: 5–6 small bulbs, 16×22 px. The wire runs past both screen edges (SVG wider than the viewport, `overflow: visible`, halo padding 24 px so nothing is clipped). Top 8 px.
  - Closed book centred (the only centred block, symmetric like a real cover). Width `min(78vw, 300px)`, linen texture, gold emboss (1 px inner shadow, no glow).
    - "PASSPORT": Courier 13, tracking .5em. This is the single allowed eyebrow, a printed one.
    - FS² roundel.
    - "FROM STUDENTS FOR STUDENTS".
    - Tagline with **neon glow** (1 of the 2 allowed glows).
    - "STUDENT BOOTH · SPECIAL EDITION".
  - Below the book, left-aligned: date (Poppins 600 15) and time · venue (Poppins 400 13, cream 70%). 20 px gap.
  - "Open Passport": primary, full width at the foot. "How it works": text link under it.
  - Logo strip, smaller (max-w 240), as a paper strip with 2 px radius.
- **Real objects:** linen weave (SVG pattern), gold foil emboss, page-edge stack peeking on the right of the closed book.
- **Transition out:** the cover rotates on the left hinge (−165°, 700 ms) inside the Booklet. Underneath is the **live Sign-in page** (`PaperPage` 01), so nothing morphs and nothing fades. The book then scales from cover size to the full Booklet size (transform only, 300 ms, starting at 450 ms).
- **Anti-patterns removed:** button glow, radial gradient background, clipped bulbs (A7), flower on the screen edge (the flower moves to the Night background bottom-left, partly behind the book).

### 2.2 Sign in / Create passport `/signin` (page 01)
- **Material:** Paper (`PaperPage variant="form"`, number 01, serial "No. FS2-—" until the NRP is known).
- **Layout:**
  - Back arrow (custom ink chevron, 44 px) top-left.
  - Serial top-right (Courier 11).
  - Printed header line "PASSPORT · FS²" stays as the page's single eyebrow.
  - Title (Baskerville 34) and subtitle (15 px, ink 75%).
  - 32 px gap.
  - Fields as **form rows**: label (10.5 caps), input with only a bottom rule (1.5 px ink 40%) and a 4 px radius focus box. Selects get the same row style.
  - Two-column rows stay as today: Department/Class of, PIN/Repeat PIN.
  - Help text 13 px ink 60%.
  - The primary button sits at the page foot.
  - MRZ (2 lines, Courier 11, ink 35%) at the very bottom.
  - Page number "01" bottom-right.
- **[if E6]** NRP becomes 10 digit boxes and the PINs 4 digit boxes (still the same `<input>` underneath for accessibility and autofill).
- **Real objects:** guilloche, paper noise, page-edge stack, spine shadow on the left edge.
- **Transitions:** NRP → PIN/Register is a **page turn forward** inside the same route (the sub-step counts as a leaf); back turns backward. Submit turns forward to `/photo`.
- **Anti-patterns removed:** the 18 px rounded sheet, centred disabled grey button (the disabled state becomes ink outline + 40% text).

### 2.3 Photo `/photo` (page 02, identity page)
- **Material:** Paper (identity page). The camera lives inside the passport.
- **Layout:**
  - Single eyebrow "Step 1 · Before the booths" in small caps, ink 60%.
  - Title "Attendance photo" (Baskerville 34) and description (15).
  - Identity block in two columns:
    - Left: the **photo box** (3:4, 132×176) with clip corners and a guilloche line across it. It contains the live viewfinder (`object-fit: cover`, mirrored for the front camera). The "Front camera" label is printed small under the box.
    - Right: data lines that already show name / NRP masked / department / class from the registration (Courier for NRP), plus a ghost image placeholder (dashed 40×52).
  - Consent line (13, ink 60%).
  - Controls on the page foot: shutter (56 px ink ring with a red core, no glow) and switch camera (custom icon) at the left. After capture: "Retake" (text) and "Use this photo" (primary).
  - **Camera fallback (A1):** when there is no stream, the photo box shows a printed instruction ("Camera unavailable…", the current text) and the primary becomes the existing "Take photo" button wired to the visible file input with `capture="user"`. The message clears once a file is picked. In mock mode an extra text button "Use sample photo" appears (dev/mock only, not part of the production copy).
- **Moment (C2):**
  1. Shutter: white flash 80 ms over the box only (not full screen).
  2. The frame freezes.
  3. The photo gets "pasted": rotate −3° → 0°, shadow 6 px → 1 px, 260 ms.
  4. MRZ types out per character (18 ms/char, ~1.3 s, skippable).
  5. Ghost image fades to 20%.
  On "Use this photo" the upload runs and the button shows inline progress (the ink fills left→right, no spinner). Then the page **turns forward** to `/onboarding`.
- **Shared element:** the photo box has `layoutId="attendance-photo"`. The same element appears in the Map header and on Passport identity page.
- **Anti-patterns removed:** Night material for a writing task, two eyebrows, polaroid fly-to-nowhere (A4), glowing shutter, hidden fallback.

### 2.4 Onboarding `/onboarding` (outside the book, Night moment)
- **Material:** Night. Decor: lights + pine silhouettes (2 kinds). Smoke is dropped to respect the 2-decor rule.
- **Layout:** unchanged order a–f. The plan draws in cream ink lines with a uniform 3 px screen-space stroke (`vector-effect: non-scaling-stroke`) instead of thick fills.
- **Pins:** all pins use the **map pin style** (`InkStamp` mini, outline = not yet). Random colours are removed (A6).
- **Vines:** removed (they were random lines). The Lounge highlight is drawn as a dashed yellow outline drawing itself (stroke-dashoffset).
- **Card:** becomes a small `TicketPaper` note sliding up from the bottom (transform), left-aligned text, "Start" primary.
- **Transitions:** in from Photo = the book closes and slides down out of view (300 ms), and the Night stage takes over. Out: "Start" → the book rises back from the bottom with the Map page open (400 ms). "Skip" does the same.

### 2.5 Map `/map` (page 03, "Lounge / Whole building")
- **Material:** Paper header strip + a **dark printed map sheet** (Night-ink paper `#1E1214` with noise, 3 px radius, cream ink lines). The plain radial-gradient panel is removed.
- **Layout:**
  - Header on paper:
    - Photo thumb (40×53, `layoutId="attendance-photo"`).
    - "Hi, name" (13) and "Booth Map" (Baskerville 26).
    - Progress lights at the right: 4 small bulbs 10×14 with soft halo, room for glow (no clipping).
    - "x of 4 stamped" (12, Courier for the numbers).
  - "Next up" line: the navy tape label + yellow strip stay (they read as tape/sticker), but sharp corners and no full-width box; the strip is sized to its text.
  - Toggle: two text tabs with an ink underline that slides (transform `x`). No pill.
  - Map sheet: fills the rest. Lights string only at the top edge of the map sheet (1 decor kind on this page).
  - Legend printed bottom-left inside the sheet (no box, 11 px).
- **Pins:** one form, a small round ink stamp (24 px on screen) with the booth initial in Anton (KOREA → "KR", TAIWAN → "TW", GERMANY → "DE", 4 → "4").
  - Not yet: ink outline.
  - Stamped: filled red ink.
  - Notes done: red + ✓.
  - Pressed: `scale(.96)` within 60 ms, no bounce.
- **Lounge ↔ Whole building:** same camera zoom (MOTION #6), 400 ms `--ease-out`.
- **Anti-patterns removed:** radial panel, 22 px rounded map box, flower sticker (moved behind the book on Night), Poppins 800 title, teardrop pins.

### 2.6 Booth pop-up (overlay on page 03)
- **Material:** `VisaSticker` (paper) on a Night scrim (Night 70%, no blur).
- **Layout (content unchanged):**
  - Sticker: sharp corners, 1.5° tilt, lift shadow from the top-left light.
    - Top: region · booth title (Baskerville 30), "Lounge · top right" as a navy tape.
    - **Country stamp** at the right, 104 px, real ink (`InkStamp`). Not stamped yet = ink at 35% with a dashed ring, **not greyscale** (A5).
    - Speaker row: retro TV (existing asset style), name (Poppins 600 18), university on the yellow label strip, program (14).
    - Story in a cream speech bubble: Baskerville italic 15, left-aligned.
    - Status line with the ink check.
  - Actions under the sticker, on Night: "Close" (text) and "Write notes / Show QR" (primary).
- **Transition:** grows **from the pressed pin** (`layoutId="pin-B2"` ↔ sticker), 380 ms spring for position/scale, content fades in after 120 ms. Close or drag-down shrinks back into the same pin. The TV "switch-on" stays.
- **Anti-patterns removed:** generic bottom sheet sliding up, 28 px top radius, eyebrow + kicker.

### 2.7 QR `/qr` (overlay ticket)
- **Material:** `TicketPaper` on Night.
- **Layout (content unchanged):**
  - Close ✕ (ink, 44 px) at the top-left of the Night area.
  - Ticket: perforation row at the top, "PASSPORT QR" as the ticket's printed header (the single eyebrow, Courier).
  - Title "Show this to the booth officer" (Baskerville 26, left-aligned).
  - The QR in an ink-ruled box (1.5 px ink, 2 px radius, quiet zone 16 px).
  - Name (Poppins 600 16) and "NRP ••••0028" (Courier 15).
  - Brightness tip with a small custom sun glyph.
  - Stub divider (dashed), then the status line with a small ink dot (no pulsing glow; a steady dot, plus a 1-cycle pulse on mount only).
- **Transition:** grows from the **QR tab** in the nav (`layoutId="qr-permit"`), 420 ms. Closing shrinks back into the tab. When a confirmation is detected the ticket slides down into the book and the stamp moment starts. **[if E2]** the ticket tucks into the passport and the book opens at the visa page, where the stamp lands, replacing the separate Stamp screen.
- **Anti-patterns removed:** yellow glowing frame, red glow, 26 px radius, centred stack, bordered status card.

### 2.8 Stamp moment `/stamp/:id` (page 05 shown early)
- **Material:** Paper (visa page) inside the Booklet; Night dims around the book only.
- **Layout:**
  - The **header progress lights stay** (same element as the Map header via `layoutId="progress-lights"`). The separate big light string is removed.
  - Visa page: "VISA · TAIWAN BOOTH · No. 02" (Courier 11).
  - The stamp lands as in MOTION #4: from scale 1.6 and blurred to scale 1, −9°, single overshoot.
  - **Ink-landing glow** (the 2nd allowed glow, 200 ms only).
  - The page shakes 2× (x ±3 px).
  - Then the neon title "Passport stamped!" appears.
  - Body text (15, left-aligned) and the two buttons "Write now" (secondary outline) / "Next booth" (primary).
- **Transition:** in = the QR ticket slides into the book and the book turns to the visa page. Out: "Write now" stays on the same page (the resume block appears below the stamp, see 2.9), "Next booth" turns back to the Map.
- **Anti-patterns removed:** the separate oversized light string, 3 radial gradients, centred text block.

### 2.9 Resume / Visa `/visa/:id` (page 05+, one leaf per booth)
- **Material:** Paper (visa page).
- **Layout:**
  - Back + "VISA · TAIWAN BOOTH" printed header (the single eyebrow).
  - Speaker name (Baskerville 30), program · university (14, ink 75%).
  - Stamp at the top-right (`InkStamp` 96 px, rotated as on the stamp page).
  - Stamp time as a Courier line "Stamped 10:01 · Lounge" on a navy tape.
  - 32 px gap.
  - "3 things you learned" (Baskerville 20) with the counter at the right (Courier, red).
  - Three **ruled writing lines** instead of boxed textareas: textarea with a transparent background and `repeating-linear-gradient` rules every 26 px, a 1 px ink rule on focus becoming 2 px. "Point n ✓" labels as form labels; words counter in Courier 12.
  - The autosave line with the cloud→check glyph.
  - "Done" primary at the page foot.
- **[if E1]** this block lives directly under the stamp on the same visa page and the separate route is only used as a deep link.
- **Transition:** turns forward from the Passport/Map, back = turns backward.
- **Anti-patterns removed:** tape-on-rounded-card, boxed textareas with 12 px radius, shadowed card.

### 2.10 Passport `/passport` (pages 04–08 as a book)
- **Material:** Paper spread.
- **Layout:**
  - **Identity page (04):**
    - Photo box 3:4 (`layoutId="attendance-photo"`) with clip corners.
    - Ghost image (20%) at the right.
    - Data in two columns with field labels (10.5 caps): Name, NRP (Courier, masked), Department, Class.
    - "FS² Passport · October" as the printed header.
    - MRZ 2 lines at the bottom.
    - Page number 04.
  - **Visa pages (05–08):**
    - Horizontally swipeable leaves (page turn with drag + velocity, interruptible).
    - Each has a printed header "VISA · SOUTH KOREA · No. 01" and a thin visa frame.
    - Stamped: `InkStamp` at a seeded position/rotation with the stamp time in Courier, the speaker name (Baskerville 20), the booth line (14), and the notes state ("3/3 ✓" in ink or "Write notes" as a text link).
    - Not stamped: the same frame with faded printed text "Not stamped" (ink 30%), no dashed card.
    - A small page indicator "05 / 08" in Courier.
  - **Requirements** become a **printed checklist** on the last leaf (checkboxes printed in ink, ✓ in red ink when met). The deadline is set in Courier.
  - Buttons: "Go to Exit page" / "View status" primary at the page foot; "Guide & help" as a text link.
- **Exit-gate use:** the page opens on the identity page with the 4 stamps visible as a "stamp summary" row of 4 mini stamps under the MRZ (information already on the screen today, just re-laid out).
- **Transition:** from the nav = page turn to page 04. Visa leaves turn between each other.
- **Anti-patterns removed:** 4 identical bordered cards, the bordered requirements box, the polaroid tilted thumbnail, the outline full-width button.

### 2.11 Exit `/exit` (page 09)
- **Material:** Paper (form page).
- **Layout:**
  - Back + "Exit page" printed header.
  - Title "One last step" (Baskerville 34).
  - Requirements as a printed checklist (ink boxes; ✓ red ink; the current step number in a small ink circle).
  - The committee note (when revising) on a **paper slip clipped to the page** (2° tilt, clip glyph).
  - Feedback questions as numbered form rows. Scale 1–5 as **5 printed boxes in one row** (44 px, 4 px radius, ink outline; selected = ink fill + paper text, 120 ms colour change, no motion). Optional text = ruled lines.
  - Primary "Submit / Resubmit" at the foot. The reason text under it (13, left-aligned).
- **Moment:** the existing envelope animation, restyled: the pages fold into the envelope (transform only), the "SENT" `InkStamp` lands (no glow), and the book turns to the Status page.
- **Anti-patterns removed:** paper card inside a dark page, grey dead button, centred reason text.

### 2.12 Status `/status` (page 10)
- **Material:** Paper.
- **Layout:**
  - Printed header "Submission status".
  - The status **stamp** (`InkStamp` rectangle variant, Anton, red/amber/green ink by status) printed directly on the page, no card.
  - "Submission code" label + code in Courier 30.
  - Committee note slip (when revising).
  - Definition list as printed rows (1 px ink 15% rules).
  - Paragraph (15, left-aligned).
  - Skyline printed at the page foot in ink at 25% (moved onto paper as a printed vignette, so it is no longer Night decor).
  - Buttons: "Passport" (text) and "Refresh / Revise" (primary).
- **Anti-patterns removed:** bordered cream card, radial background, centred stack, big light string (removed; the header lights carry progress).

### 2.13 Guide `/guide` (page "back matter")
- **Material:** Paper (the passport's printed instruction pages).
- **Layout:**
  - Title (Baskerville 34).
  - Numbered steps as printed ordinals (Courier "01–06" in the margin).
  - Stamp4It rules as a ruled box **without radius** (1 px ink frame, printed like an official notice).
  - Rundown as a timetable (Courier times).
  - Help: two text buttons with the WhatsApp label.
  - Replay/sound/sign-out as plain rows.
  - The logo strip printed at the foot.
- **Decor:** the grandfather clock moves outside the page onto Night (bottom-left, behind the book). That is the single decor kind here.

### 2.14 Participant navigation
- **Default:** a cover-cloth bar fixed to the bottom of the Booklet (navy linen, 56 px) with 3 custom ink icons + labels (Map · QR · Passport). The QR item is a small **permit tab** sticking up 8 px above the bar (paper, perforated top, Anton "QR"), with no glow and no circle.
- **[if E4]** the bar becomes tabs clipped to the book's right edge (Map · Permit · Passport) and the bottom bar disappears.
- Press feedback within 60 ms (ink darkens). Switching tabs is a page turn.

---

## 3. Night material (everywhere outside the book)
- `#120A0B → #1C0D0F` linear (top → bottom) + 4% noise.
- **One red light source:** a soft red glow coming from a "crack" at the bottom edge. It is a positioned blurred ellipse layer at 18%, not a radial background gradient.
- Decor (max 2 kinds per screen) lives here only.

| Screen | Decor 1 | Decor 2 |
| --- | --- | --- |
| Cover | lights | flower (behind book, bottom-left) |
| Onboarding | lights | pines |
| Map | lights (on the map sheet top) | — |
| Pop-up | — | — |
| Stamp | clouds (bottom) | — |
| Guide | clock | — |
| others | — | — |

## 4. Motion summary (DESIGN.md §6)

| Token | Value | Used for |
| --- | --- | --- |
| `--ease-out` | `cubic-bezier(.22,1,.36,1)` | UI 150–250 ms |
| `--ease-page` | `cubic-bezier(.65,0,.35,1)` | page turn 520 ms |
| spring physical | `stiffness 500, damping 28` | stamp, pin press-down only |
| spring sheet | `stiffness 260, damping 30` | page drag release, grow/shrink overlays |
| reduced motion | 120 ms crossfade | all of the above |

Never animated: typing, toggling the same tab, the scale buttons, autosave.

## 5. Verification per screen (during step 4)
After each screen:
1. 390×844 screenshot.
2. Grep the screen for `rounded-2xl|rounded-3xl|rounded-\[(1[2-9]|2\d)px\]|shadow-\[0_0_|radial-gradient|kicker`.
3. Count eyebrows (≤1) and decor kinds (≤2).
4. Confirm the text diff is empty (`git diff -U0 | grep '^[-+].*>[^<{]*[A-Za-z]'` reviewed by hand).
