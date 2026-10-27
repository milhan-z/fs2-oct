// Captures real app screens (mock mode, 390×844 @3x) for the full participant guide, plus the screen rects of the
// elements the film highlights. Run it against a production build in mock mode:
//   VITE_DATA_MODE=mock npm run build && npx vite preview --port 4173
//   node video/guide/capture.mjs http://localhost:4173
// The "camera" shows a real portrait and two booth speakers get real photos (video/private/, never committed).
import { chromium } from '@playwright/test'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:4173'
const OUT = 'video/guide/shots'
mkdirSync(OUT, { recursive: true })
const rects = {}

const dataUrl = (f) => `data:image/jpeg;base64,${readFileSync(f).toString('base64')}`
const PORTRAIT = dataUrl('video/private/alex-portrait.jpg')
const SPEAKERS = { B1: dataUrl('video/private/rahmat-speaker.jpg'), B2: dataUrl('video/private/tegar-speaker.jpg') }
const fakeCamera = (src) => {
  navigator.mediaDevices.getUserMedia = async () => {
    const img = new Image()
    img.src = src
    await img.decode()
    const c = document.createElement('canvas')
    c.width = 720
    c.height = 960
    const g = c.getContext('2d')
    const draw = (t) => {
      const z = 1.0 + 0.012 * Math.sin(t / 1500)
      g.save()
      g.translate(360, 480)
      g.scale(z, z)
      g.drawImage(img, -360, -480, 720, 960)
      g.restore()
    }
    draw(0)
    setInterval(() => draw(performance.now()), 66)
    return c.captureStream(15)
  }
}

const browser = await chromium.launch()
const phone = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: false, hasTouch: true, colorScheme: 'dark' }
const wait = (page, ms) => page.waitForTimeout(ms)
const hide = (page) =>
  page.evaluate(() => {
    for (const b of document.querySelectorAll('button')) if (b.textContent?.trim() === 'DEV') b.style.opacity = '0'
  })
const shot = async (page, n) => {
  await hide(page)
  await page.screenshot({ path: `${OUT}/${n}.png` })
}
const rect = async (name, loc) => {
  const b = await loc.first().boundingBox()
  if (b) rects[name] = { x: b.x, y: b.y, w: b.width, h: b.height }
  else console.log('no rect for', name)
}
const dev = async (page, label) => {
  await page.getByRole('button', { name: 'DEV', exact: true }).click()
  await page.getByRole('button', { name: label, exact: true }).click()
  await page.getByRole('button', { name: 'DEV', exact: true }).click()
}
const scrollPage = async (page, key, y) => {
  await page.evaluate(
    ([k, to]) => {
      const sc = document.querySelector(`[data-page="${k}"]`)
      if (sc) sc.scrollTop = to === 'end' ? sc.scrollHeight : to
    },
    [key, y],
  )
  await page.waitForTimeout(500)
}
const fresh = async (page) => {
  await page.goto(`${BASE}/?dev=1`)
  await page.evaluate(() => {
    Object.keys(localStorage).forEach((k) => k.startsWith('fs2.') && localStorage.removeItem(k))
    sessionStorage.clear()
  })
  await page.goto(`${BASE}/?dev=1`)
  await wait(page, 3200)
}
const register = async (page, nrp, nama) => {
  await page.getByRole('button', { name: 'Open Passport' }).click()
  await wait(page, 1800)
  await page.getByLabel('NRP', { exact: true }).fill(nrp)
  await page.getByRole('button', { name: 'Continue' }).click()
  await wait(page, 900)
  await page.getByLabel('Full name').fill(nama)
  await page.getByLabel('4-digit PIN').fill('1234')
  await page.getByLabel('Repeat PIN').fill('1234')
}

// ---------------------------------------------------------------------------------------------
// 1. the "why we need your camera" screen: only shown while the camera permission is still undecided
// ---------------------------------------------------------------------------------------------
{
  const ctx = await browser.newContext(phone)
  await ctx.addInitScript(fakeCamera, PORTRAIT)
  const page = await ctx.newPage()
  await fresh(page)
  await register(page, '5025240099', 'Audrey Alexandro')
  await page.getByRole('button', { name: 'Create passport' }).click()
  await page.getByRole('dialog', { name: /take your passport photo/i }).waitFor({ timeout: 8000 })
  await wait(page, 700)
  await shot(page, 'pt04-primer')
  await rect('primerContinue', page.getByRole('dialog').getByRole('button', { name: 'Continue' }))
  await ctx.close()
}

// ---------------------------------------------------------------------------------------------
// 2. the whole journey
// ---------------------------------------------------------------------------------------------
const ctx = await browser.newContext({ ...phone, permissions: ['camera'] })
await ctx.addInitScript(fakeCamera, PORTRAIT)
const page = await ctx.newPage()
await fresh(page)
await shot(page, 'pt01-cover')
await rect('openPassport', page.getByRole('button', { name: 'Open Passport' }))

await page.getByRole('button', { name: 'Open Passport' }).click()
await wait(page, 1800)
await page.getByLabel('NRP', { exact: true }).fill('5025240028')
await wait(page, 250)
await shot(page, 'pt02-nrp')
await rect('nrp', page.getByLabel('NRP', { exact: true }))
await rect('continue', page.getByRole('button', { name: 'Continue' }))
await page.getByRole('button', { name: 'Continue' }).click()
await wait(page, 1100)
await page.getByLabel('Full name').fill('Audrey Alexandro')
await page.getByLabel('4-digit PIN').fill('1234')
await page.getByLabel('Repeat PIN').fill('1234')
await wait(page, 300)
await shot(page, 'pt03-register')
await rect('regNrp', page.locator('#r-nrp'))
await rect('regDept', page.locator('#r-dept'))
await rect('regYear', page.locator('#r-angk'))
await rect('regPin', page.locator('#r-pin'))
await rect('regPin2', page.locator('#r-pin2'))
await rect('createPassport', page.getByRole('button', { name: 'Create passport' }))
await page.getByRole('button', { name: 'Create passport' }).click()
await page.getByRole('dialog', { name: 'Attendance photo camera' }).waitFor({ timeout: 8000 })
await wait(page, 1400)
await shot(page, 'pt05-camera')
await rect('shutter', page.getByRole('button', { name: 'Take photo' }))
await page.getByRole('button', { name: 'Take photo' }).click()
await wait(page, 700)
await shot(page, 'pt06-shot')
await rect('usePhoto', page.getByRole('button', { name: 'Use this photo' }))
await page.getByRole('button', { name: 'Use this photo' }).click()
await page.waitForURL(/onboarding|map/, { timeout: 15000 })
if (page.url().includes('onboarding')) {
  await wait(page, 1500)
  await page.getByRole('button', { name: 'Skip' }).click().catch(() => {})
  await page.getByRole('button', { name: 'Start' }).click({ timeout: 8000 }).catch(() => {})
}
await page.waitForURL('**/map')
await page.getByRole('button', { name: 'Skip tour' }).click({ timeout: 5000 }).catch(() => {})
// real photos for the speakers of South Korea (B1) and Taiwan TISS (B2); only this browser's copy of the mock data
await page.evaluate((photos) => {
  const db = JSON.parse(localStorage.getItem('fs2.mockdb'))
  for (const sp of db.content.speakers) {
    if (!photos[sp.boothId]) continue
    Object.assign(sp, { foto: photos[sp.boothId], placeholder: false, cerita: 'Come say hi at the booth. Your stamp is waiting!' })
  }
  localStorage.setItem('fs2.mockdb', JSON.stringify(db))
}, SPEAKERS)
await page.reload()
await wait(page, 3400)
await shot(page, 'pt07-map-building')
await rect('tabBuilding', page.getByRole('tab', { name: /Whole building/ }))
await rect('tabLounge', page.getByRole('tab', { name: /^Lounge/ }))
await rect('tabPartnership', page.getByRole('tab', { name: /^Partnership/ }))
await rect('mapArea', page.locator('svg[role="group"]'))
await rect('legend', page.getByRole('list', { name: 'Pin legend' }))
await rect('tabQR', page.getByRole('button', { name: 'QR', exact: true }))
await page.getByRole('tab', { name: /^Lounge/ }).click()
await wait(page, 1300)
await shot(page, 'pt08-map-lounge')
await rect('backBtn', page.getByRole('button', { name: /Whole building/ }))
await rect('pinKorea', page.getByRole('button', { name: /South Korea booth/ }))
await page.getByRole('tab', { name: /^Partnership/ }).click()
await wait(page, 1300)
await shot(page, 'pt09-map-partnership')
await rect('pinGermany', page.getByRole('button', { name: /Germany booth/ }))
await page.getByRole('tab', { name: /^Lounge/ }).click()
await wait(page, 1000)
await page.getByRole('button', { name: /South Korea booth/ }).click({ force: true })
await wait(page, 1200)
await shot(page, 'pt10-sheet')
await rect('showQr', page.getByRole('button', { name: 'Show QR' }))
await page.getByRole('button', { name: 'Close', exact: true }).click()
await wait(page, 600)
await dev(page, 'During session')
await wait(page, 600)
await page.getByRole('button', { name: 'QR', exact: true }).click()
await wait(page, 1700)
await shot(page, 'pt11-qr')
{
  // the QR code itself: the largest svg / canvas on the page
  const b = await page.evaluate(() => {
    let best = null
    for (const e of document.querySelectorAll('svg, canvas')) {
      const r = e.getBoundingClientRect()
      if (r.width > 120 && r.width < 380 && Math.abs(r.width - r.height) < 6 && (!best || r.width > best.w)) best = { x: r.x, y: r.y, w: r.width, h: r.height }
    }
    return best
  })
  if (b) rects.qrCode = b
}
await dev(page, 'Stamp B1')
await page.waitForURL('**/stamp/**', { timeout: 8000 })
await wait(page, 3900)
await shot(page, 'pt12-stamp')
await rect('writeNow', page.getByRole('button', { name: 'Write now' }))
await page.getByRole('button', { name: 'Write now' }).click()
await wait(page, 1500)
const scrollNotes = () =>
  page.evaluate(() => {
    const el = [...document.querySelectorAll('h2,h3')].find((h) => /brought back/i.test(h.textContent || ''))
    el?.scrollIntoView({ block: 'start' })
    // scrollIntoView also nudges clipped ancestors (overflow:hidden); put every one of them back
    for (let n = el?.parentElement; n; n = n.parentElement) {
      const o = getComputedStyle(n).overflowY
      if (o === 'hidden' || o === 'visible' || n === document.documentElement || n === document.body) {
        n.scrollTop = 0
        n.scrollLeft = 0
      }
    }
  })
await page.getByLabel(/Point 1/).fill('Bagus')
await wait(page, 400)
await scrollNotes()
await wait(page, 600)
await shot(page, 'pt13-notes-short')
await rect('notePoint1', page.getByLabel(/Point 1/))
await rect('noteWarn', page.getByRole('status').filter({ hasText: /count so far/ }))
await rect('noteCount1', page.locator('label[for="poin-0"]').locator('xpath=..'))
await page.getByLabel(/Point 1/).fill('The internship route is a realistic first step abroad.')
await page.getByLabel(/Point 2/).fill('Start your visa and housing paperwork a semester early.')
await page.getByLabel(/Point 3/).fill('Alumni networks help the most in your first month.')
await wait(page, 2000)
await scrollNotes()
await wait(page, 500)
await shot(page, 'pt14-notes-ok')
await rect('notesTitle', page.locator('#resume-title'))
await rect('notesDone', page.getByRole('button', { name: 'Done', exact: true }))
await page.getByRole('button', { name: 'Done', exact: true }).click()
await wait(page, 900)
// the other three booths (any four will do): Japan (B4), Taiwan NTUST (B5), Germany (B3)
for (const b of ['Stamp B4', 'Stamp B5', 'Stamp B3']) {
  await dev(page, b)
  await page.waitForURL('**/stamp/**', { timeout: 8000 })
  await wait(page, 1200)
  await page.getByRole('button', { name: /Next booth|Back to map/ }).click()
  await page.waitForURL('**/map')
}
await dev(page, 'Auto-fill notes')
await page.getByRole('button', { name: 'Passport', exact: true }).click()
await wait(page, 1500)
await scrollPage(page, 'passport', 0)
await wait(page, 700)
await scrollPage(page, 'passport', 0)
await shot(page, 'pt15-passport')
await rect('passNrp', page.locator('dd.doc-data').first())
await rect('passPhoto', page.getByRole('button', { name: /attendance photo/i }))
await rect('passName', page.locator('dl dd').first())
await page.evaluate(() => {
  const h = [...document.querySelectorAll('h2')].find((x) => /Visa pages/.test(x.textContent || ''))
  const sc = document.querySelector('[data-page="passport"]')
  if (h && sc) sc.scrollTop += h.getBoundingClientRect().top - 150
})
await wait(page, 600)
await shot(page, 'pt16-passport-progress')
await rect('visasHead', page.locator('h2', { hasText: 'Visa pages' }).locator('xpath=..'))
await rect('visas', page.locator('ul.grid').first())
if (rects.visas) rects.visas.h = Math.min(rects.visas.h, 400)
await scrollPage(page, 'passport', 'end')
await shot(page, 'pt16b-passport-submit')
await rect('answerSubmit', page.getByRole('button', { name: /Answer & submit/ }))
await page.getByRole('button', { name: /Answer & submit/ }).click()
await wait(page, 1600)
await shot(page, 'pt17-exit-scale')
await rect('scale', page.getByRole('radio').first().locator('xpath=..'))
for (let k = 0; k < 4; k++) {
  await page.getByRole('radio').nth(4).click()
  await wait(page, 650)
}
await page.getByLabel('Criticism and Suggestions for Material').fill('The booths were very helpful, thank you!')
await wait(page, 600)
await shot(page, 'pt18-exit-text')
await rect('submit', page.getByRole('button', { name: 'Submit', exact: true }))
await page.getByRole('button', { name: 'Submit', exact: true }).click().catch(() => {})
await page.waitForURL('**/status', { timeout: 10000 }).catch(() => {})
await wait(page, 2400)
await scrollPage(page, 'status', 0)
await shot(page, 'pt19-status-wait')
await rect('statusStamp', page.getByText('AWAITING REVIEW'))

// the committee approves (admin console in a second tab of the same browser)
const admin = await ctx.newPage()
await admin.setViewportSize({ width: 1440, height: 810 })
await admin.goto(`${BASE}/admin/submissions`)
await admin.fill('input[type=password]', 'fs2admin')
await admin.keyboard.press('Enter')
await admin.getByRole('button', { name: 'Approve', exact: true }).first().waitFor({ timeout: 8000 })
await admin.getByRole('button', { name: 'Approve', exact: true }).first().click()
await wait(admin, 1200)
await page.bringToFront()
await page.reload()
await wait(page, 2600)
await shot(page, 'pt20-status-approved')
await rect('statusStampOk', page.getByText('APPROVED'))
await rect('stamp4itRow', page.getByText('Stamp4It').first().locator('xpath=..'))
await admin.bringToFront()
await admin.getByRole('tab', { name: /Approved/ }).click()
await admin.getByLabel('Stamp4It').first().check()
await wait(admin, 1200)
await page.bringToFront()
await page.reload()
await wait(page, 2600)
await shot(page, 'pt21-status-given')
await rect('stamp4itGiven', page.getByText('Given', { exact: true }))
await rect('stamp4itRow2', page.getByText('Stamp4It').first().locator('xpath=..'))

writeFileSync(`${OUT}/rects.json`, JSON.stringify(rects, null, 2))
console.log(JSON.stringify(rects))
await browser.close()
