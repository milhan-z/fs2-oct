// Captures the real booth-staff and admin screens (mock mode) for the committee tutorial video.
// Phone screens 390×844 and desktop screens 1440×810, both at 2x.
//   node video/committee/capture.mjs [baseUrl]      env: PYTHON (with Pillow), FFMPEG
// Needs video/private/alex-portrait.jpg (not committed). The extra participant names are fictional.
import { chromium } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:5173'
const OUT = 'video/committee/shots'
mkdirSync(OUT, { recursive: true })
const rects = {}
const dataUrl = (f) => `data:image/jpeg;base64,${readFileSync(f).toString('base64')}`
const PORTRAIT = dataUrl('video/private/alex-portrait.jpg')
const NAMES = ['Nadia Putri Maharani', 'Raka Pratama', 'Salsabila Ananda', 'Dimas Aryo Saputra', 'Intan Permatasari', 'Fajar Nugroho', 'Maya Kusuma Dewi', 'Bagas Wicaksono', 'Citra Lestari', 'Yoga Prasetyo', 'Anisa Rahma', 'Rizky Firmansyah']
const PY = process.env.PYTHON || 'python'
const FFMPEG = process.env.FFMPEG || 'ffmpeg'
const STATE = 'video/private/committee-state.json'
const Y4M = 'video/private/staff-camera.y4m'
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

// ---- phase 1: Audrey registers with her real photo (a drawn "camera" showing her portrait) ----------
{
  const browser = await chromium.launch()
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, permissions: ['camera'], colorScheme: 'dark' })
  await ctx.addInitScript((portrait) => {
    navigator.mediaDevices.getUserMedia = async () => {
      const img = new Image()
      img.src = portrait
      await img.decode()
      const c = document.createElement('canvas')
      c.width = 720
      c.height = 960
      const g = c.getContext('2d')
      const draw = () => g.drawImage(img, 0, 0, 720, 960)
      draw()
      setInterval(draw, 66)
      return c.captureStream(15)
    }
  }, PORTRAIT)
  const P = await ctx.newPage()
  await P.goto(`${BASE}/?dev=1`)
  await P.evaluate(() => Object.keys(localStorage).forEach((k) => k.startsWith('fs2.') && localStorage.removeItem(k)))
  await P.goto(`${BASE}/?dev=1`)
  await wait(2500)
  await P.getByRole('button', { name: 'Open Passport' }).click()
  await wait(1500)
  await P.getByLabel('NRP', { exact: true }).fill('5025240028')
  await P.getByRole('button', { name: 'Continue' }).click()
  await wait(800)
  await P.getByLabel('Full name').fill('Audrey Alexandro')
  await P.getByLabel('Department').selectOption('Informatics')
  await P.getByLabel('4-digit PIN').fill('1234')
  await P.getByLabel('Repeat PIN').fill('1234')
  await P.getByRole('button', { name: 'Create passport' }).click()
  await P.getByRole('dialog', { name: 'Attendance photo camera' }).waitFor({ timeout: 6000 })
  await wait(1200)
  await P.getByRole('button', { name: 'Take photo' }).and(P.locator(':enabled')).click()
  await wait(700)
  await P.getByRole('button', { name: 'Use this photo' }).click()
  await P.waitForURL(/onboarding|map/, { timeout: 15000 })
  if (P.url().includes('onboarding')) {
    await wait(1200)
    await P.getByRole('button', { name: 'Skip' }).click().catch(() => {})
    await P.getByRole('button', { name: 'Start' }).click({ timeout: 8000 }).catch(() => {})
  }
  await P.waitForURL('**/map')
  await P.getByRole('button', { name: 'Skip tour' }).click({ timeout: 5000 }).catch(() => {})
  await wait(1800)
  await P.getByRole('button', { name: 'QR', exact: true }).click()
  await wait(1500)
  await P.locator('svg:has(title)').first().screenshot({ path: `${OUT}/audrey-qr.png` })
  await ctx.storageState({ path: STATE })
  await browser.close()
}
execFileSync(PY, ['video/committee/camera_frames.py', `${OUT}/audrey-qr.png`, 'video/committee/junk-qr.png', Y4M, FFMPEG], { stdio: 'inherit' })

// ---- phase 2: everything else; the looping fake camera feeds the staff scanner -----------------------
const browser = await chromium.launch({
  args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-video-capture=${Y4M}`],
})
const ctx = await browser.newContext({ storageState: STATE, viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, permissions: ['camera'], colorScheme: 'dark' })
const P = await ctx.newPage() // participant
const S = await ctx.newPage() // staff
const A = await ctx.newPage() // admin
await A.setViewportSize({ width: 1440, height: 810 })
const hide = (pg) =>
  pg.evaluate(() => {
    for (const b of document.querySelectorAll('button')) if (b.textContent?.trim() === 'DEV') b.style.opacity = '0'
  })
const shot = async (pg, n) => {
  await hide(pg)
  await pg.screenshot({ path: `${OUT}/${n}.png` })
}
const rect = async (n, loc) => {
  const b = await loc.first().boundingBox()
  if (b) rects[n] = { x: b.x, y: b.y, w: b.width, h: b.height }
}
const dev = async (pg, label) => {
  await pg.getByRole('button', { name: 'DEV', exact: true }).click()
  await pg.getByRole('button', { name: label, exact: true }).click()
  await pg.getByRole('button', { name: 'DEV', exact: true }).click()
}

// data for the rehearsal: session open, 12 more participants with plausible (fictional) names
await P.goto(`${BASE}/map?dev=1`)
await wait(2000)
await dev(P, 'During session')
await dev(P, '+ 12 dummy participants')
await P.evaluate((names) => {
  const db = JSON.parse(localStorage.getItem('fs2.mockdb'))
  let i = 0
  for (const p of db.participants) if (/^(Test Participant|Demo Student|Exchange Hopeful)/.test(p.nama)) p.nama = names[i++ % names.length]
  localStorage.setItem('fs2.mockdb', JSON.stringify(db))
}, NAMES)
await P.reload()
await wait(1500)

// ---- staff phone -------------------------------------------------------------------------------
await S.goto(`${BASE}/staff?dev=1`)
await wait(1500)
await S.getByLabel('Staff PIN').fill('555555')
await wait(300)
await shot(S, 'st01-pin')
await rect('st01-signin', S.getByRole('button', { name: 'Sign in' }))
await S.getByRole('button', { name: 'Sign in' }).click()
await S.getByRole('heading', { name: /Which booth/ }).waitFor()
await wait(500)
await shot(S, 'st02-booths')
await rect('st02-korea', S.getByRole('link', { name: /South Korea/ }))
await S.getByRole('link', { name: /South Korea/ }).click()
await S.getByRole('heading', { name: 'Rapid scan' }).waitFor()
await wait(2200)
await shot(S, 'st03-scanner')
await rect('st03-switch', S.getByLabel('Booth', { exact: true }))
await rect('st03-camera', S.locator('video'))
await rect('st03-tabs', S.getByRole('tablist'))

// the participant holds up her QR (the fake camera loop shows it every 30 s)
await S.getByText('Audrey Alexandro').first().waitFor({ timeout: 45000 })
await wait(300)
await shot(S, 'st04-scanned')
await rect('st04-item', S.getByText('Audrey Alexandro').first())
// two more from the DEV simulator, as if scanned in a row
for (let i = 0; i < 2; i++) {
  await S.getByRole('button', { name: /DEV: simulate/ }).click()
  await wait(500)
}
await wait(400)
await shot(S, 'st05-queue')
await rect('st05-first', S.locator('li', { hasText: 'Audrey Alexandro' }).first())
await rect('st05-second', S.locator('li', { hasText: 'Fajar' }).first())
await rect('st05-camera', S.locator('video'))
await rect('st05-confirm', S.getByRole('button', { name: /Confirm all/ }))
await rect('st05-manual', S.getByRole('button', { name: /Manual entry/ }))

// confirm → the participant phone jumps to the stamp moment
await S.getByRole('button', { name: /Confirm all/ }).click()
await wait(700)
await shot(S, 'st06-confirmed')
await P.waitForURL('**/stamp/**', { timeout: 15000 })
await wait(3800)
await shot(P, 'pt01-stamp')

// duplicate and unknown QR (the loop shows the participant again, then a non-FS² QR)
await S.getByText('Not an FS² passport QR').first().waitFor({ timeout: 45000 })
await shot(S, 'st07-states')
await rect('st07-unknown', S.locator('li', { hasText: 'Not an FS² passport QR' }).first())
await rect('st07-dup', S.locator('li', { hasText: 'Already stamped at this booth' }).first())
await wait(7000)

// manual entry
await S.getByRole('button', { name: /Manual entry/ }).click()
await S.getByLabel('Last 4 digits of NRP').fill('0028')
await S.getByRole('button', { name: 'Search' }).click()
await wait(900)
await shot(S, 'st08-manual')
await rect('st08-input', S.getByLabel('Last 4 digits of NRP'))
await rect('st08-result', S.getByRole('button', { name: /Audrey Alexandro/ }))
await S.getByRole('button', { name: 'Close', exact: true }).click()
await wait(400)

// history & undo
await S.getByRole('tab', { name: /History/ }).click()
await wait(1200)
await shot(S, 'st09-history')
await rect('st09-undo', S.getByRole('button', { name: 'Undo' }))

// outside session hours
await dev(P, 'Before session')
await S.reload()
await S.getByRole('heading', { name: 'Rapid scan' }).waitFor()
await wait(1500)
await shot(S, 'st10-closed')
await rect('st10-banner', S.getByRole('status').first())
await dev(P, 'During session')

// ---- finish Audrey's passport so the admin has a real submission --------------------------------
for (const b of ['Stamp B2', 'Stamp B3', 'Stamp B4']) {
  await dev(P, b)
  await P.waitForURL('**/stamp/**', { timeout: 8000 })
  await wait(900)
  await P.getByRole('button', { name: /Next booth|Back to map/ }).click()
  await P.waitForURL('**/map')
}
await dev(P, 'Auto-fill notes')
await P.goto(`${BASE}/exit?dev=1`)
await wait(1500)
for (let k = 0; k < 4; k++) {
  await P.getByRole('radio').nth(4).click()
  await wait(600)
}
await P.getByLabel('Criticism and Suggestions for Material').fill('-')
await wait(500)
await P.getByRole('button', { name: 'Submit', exact: true }).click()
await P.waitForURL('**/status', { timeout: 10000 })
await wait(1500)

// ---- admin desktop -----------------------------------------------------------------------------
await A.goto(`${BASE}/admin?dev=1`)
await wait(1500)
await A.getByLabel('Password').fill('fs2admin')
await shot(A, 'ad01-login')
await rect('ad01-pw', A.getByLabel('Password'))
await rect('ad01-signin', A.getByRole('button', { name: 'Sign in' }))
await A.getByRole('button', { name: 'Sign in' }).click()
await wait(2200)
await shot(A, 'ad02-overview')
await rect('ad02-stats', A.getByText('Registered', { exact: true }).locator('xpath=ancestor::div[2]'))
await rect('ad02-scans', A.getByText('Scans per booth').locator('xpath=ancestor::div[1]'))
await rect('ad02-latest', A.getByText('Latest confirmations').locator('xpath=ancestor::div[1]'))
await A.getByRole('link', { name: /Submissions/ }).click()
await wait(1500)
await shot(A, 'ad03-submissions')
await rect('ad03-first', A.getByRole('button', { name: /Audrey Alexandro/ }).first())
await A.getByRole('button', { name: /Audrey Alexandro/ }).first().click()
await wait(1500)
await shot(A, 'ad04-detail')
await rect('ad04-approve', A.getByRole('button', { name: 'Approve' }))
await rect('ad04-return', A.getByRole('button', { name: 'Return' }))
await A.getByRole('button', { name: 'Approve' }).click()
await wait(1200)
await shot(A, 'ad05-approved')
await rect('ad05-stamp4it', A.getByRole('checkbox', { name: /Stamp4It/ }))
await A.getByRole('link', { name: 'Participants' }).click()
await wait(1500)
await A.getByRole('button', { name: 'Edit' }).first().click()
await wait(700)
await shot(A, 'ad06-participants')
await rect('ad06-form', A.getByText('Edit participant').locator('xpath=ancestor::form'))
await rect('ad06-edit', A.getByRole('button', { name: 'Edit' }))
await rect('ad06-reset', A.getByRole('button', { name: 'Reset PIN' }))
await rect('ad06-delete', A.getByRole('button', { name: 'Delete' }))
await A.getByRole('link', { name: /Booths/ }).click()
await wait(1800)
await shot(A, 'ad07-content-map')
await A.getByRole('heading', { name: /Staff PIN/ }).scrollIntoViewIfNeeded()
await wait(500)
await shot(A, 'ad08-content-staffpin')
await rect('ad08-staffpin', A.getByRole('heading', { name: /Staff PIN/ }).locator('xpath=ancestor::div[1]'))
await A.getByRole('heading', { name: /Feedback questions/ }).scrollIntoViewIfNeeded()
await wait(600)
await shot(A, 'ad09-content-questions')
await rect('ad09-questions', A.getByRole('heading', { name: /Feedback questions/ }).locator('xpath=ancestor::div[1]'))
await A.getByRole('link', { name: 'Settings' }).click()
await wait(1500)
await shot(A, 'ad10-settings')
await rect('ad10-sim', A.getByText('Simulation mode', { exact: true }).locator('xpath=ancestor::label[1]'))
await rect('ad10-hours', A.getByText('Booth session starts', { exact: false }).locator('xpath=ancestor::div[2]'))
await A.getByRole('link', { name: 'Export' }).click()
await wait(1500)
await shot(A, 'ad11-export')
await rect('ad11-xlsx', A.getByRole('button', { name: 'Download XLSX' }))
await rect('ad11-csv', A.getByRole('button', { name: 'Download CSV' }))

writeFileSync(`${OUT}/rects.json`, JSON.stringify(rects, null, 2))
console.log(Object.keys(rects).length, 'rects')
await browser.close()
