// Captures real app screens (mock mode, 390×844 @3x) for the tutorial video, plus the screen rects
// of the elements the video highlights. Usage: node video/capture.mjs [baseUrl]
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:5173'
const OUT = 'video/shots'
mkdirSync(OUT, { recursive: true })
const rects = {}

const browser = await chromium.launch()
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: false, hasTouch: true, permissions: ['camera'], colorScheme: 'dark' })
// a drawn portrait as the "camera" so the polaroid shows a clean picture, not Chromium's test pattern
await ctx.addInitScript(() => {
  navigator.mediaDevices.getUserMedia = async () => {
    const c = document.createElement('canvas')
    c.width = 720
    c.height = 960
    const g = c.getContext('2d')
    const draw = (t) => {
      const bg = g.createLinearGradient(0, 0, 0, 960)
      bg.addColorStop(0, '#3a2a35')
      bg.addColorStop(1, '#8a4a3c')
      g.fillStyle = bg
      g.fillRect(0, 0, 720, 960)
      const glow = g.createRadialGradient(560, 200, 20, 560, 200, 520)
      glow.addColorStop(0, 'rgba(255,190,120,.55)')
      glow.addColorStop(1, 'rgba(255,190,120,0)')
      g.fillStyle = glow
      g.fillRect(0, 0, 720, 960)
      g.fillStyle = '#1d1520'
      g.beginPath()
      g.ellipse(360, 1000, 330, 330, 0, Math.PI, 0)
      g.fill()
      g.fillStyle = '#e8c3a6'
      g.beginPath()
      g.ellipse(360, 430 + Math.sin(t / 900) * 4, 150, 190, 0, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#2a1a22'
      g.beginPath()
      g.ellipse(360, 330 + Math.sin(t / 900) * 4, 160, 120, 0, Math.PI, 0)
      g.fill()
      g.fillStyle = '#e8c3a6'
      g.fillRect(325, 600, 70, 80)
    }
    draw(0)
    const s = c.captureStream(15)
    setInterval(() => draw(performance.now()), 66)
    return s
  }
})
const page = await ctx.newPage()
const wait = (ms) => page.waitForTimeout(ms)
const hide = () =>
  page.evaluate(() => {
    for (const b of document.querySelectorAll('button')) if (b.textContent?.trim() === 'DEV') b.style.opacity = '0'
  })
const shot = async (n) => {
  await hide()
  await page.screenshot({ path: `${OUT}/${n}.png` })
}
const rect = async (name, loc) => {
  const b = await loc.boundingBox()
  if (b) rects[name] = { x: b.x, y: b.y, w: b.width, h: b.height }
}
const dev = async (label) => {
  await page.getByRole('button', { name: 'DEV', exact: true }).click()
  await page.getByRole('button', { name: label, exact: true }).click()
  await page.getByRole('button', { name: 'DEV', exact: true }).click()
}
await page.goto(`${BASE}/?dev=1`)
await page.evaluate(() => Object.keys(localStorage).forEach((k) => k.startsWith('fs2.') && localStorage.removeItem(k)))
await page.goto(`${BASE}/?dev=1`)
await wait(3200)
await shot('s01-cover')
await rect('openPassport', page.getByRole('button', { name: 'Open Passport' }))

await page.getByRole('button', { name: 'Open Passport' }).click()
await wait(1800)
await page.getByLabel('NRP', { exact: true }).fill('5025240028')
await wait(200)
await shot('s02-signin')
await rect('nrp', page.getByLabel('NRP', { exact: true }))
await rect('continue', page.getByRole('button', { name: 'Continue' }))
await page.getByRole('button', { name: 'Continue' }).click()
await wait(900)
await page.getByLabel('Full name').fill('Alex Rivera')
await page.getByLabel('Department').selectOption('Informatics')
await page.getByLabel('4-digit PIN').fill('1234')
await page.getByLabel('Repeat PIN').fill('1234')
await wait(200)
await shot('s03-register')
await page.getByRole('button', { name: 'Create passport' }).click()
await page.getByRole('dialog', { name: 'Attendance photo camera' }).waitFor({ timeout: 6000 })
await wait(1400)
await shot('s04-photo-cam')
await rect('shutter', page.getByRole('button', { name: 'Take photo' }))
await page.getByRole('button', { name: 'Take photo' }).click()
await wait(700)
await shot('s05-photo-shot')
await rect('usePhoto', page.getByRole('button', { name: 'Use this photo' }))
await page.getByRole('button', { name: 'Use this photo' }).click()
await page.waitForURL(/onboarding|map/, { timeout: 15000 })
if (page.url().includes('onboarding')) {
  await wait(1500)
  await page.getByRole('button', { name: 'Skip' }).click().catch(() => {})
  await page.getByRole('button', { name: 'Start' }).click({ timeout: 8000 }).catch(() => {})
}
await page.waitForURL('**/map')
await wait(2600)
await shot('s06-map')
const pin = page.getByRole('button', { name: /Taiwan booth/ })
await rect('pinTaiwan', pin)
await rect('pinKorea', page.getByRole('button', { name: /South Korea booth/ }))
await rect('pinGermany', page.getByRole('button', { name: /Germany booth/ }))
await rect('pinB4', page.getByRole('button', { name: /Booth 4/ }))
await rect('tabQR', page.getByRole('button', { name: 'QR', exact: true }))
await pin.click()
await wait(1100)
await shot('s07-map-sheet')
await page.getByRole('button', { name: 'Close', exact: true }).click()
await wait(500)
await page.getByRole('button', { name: 'QR', exact: true }).click()
await wait(1600)
await shot('s08-qr')
await dev('Stamp B2')
await page.waitForURL('**/stamp/**', { timeout: 8000 })
await wait(3800)
await shot('s09-stamp')
// notes: empty then filled
await page.goto(`${BASE}/visa/B2`)
await wait(1600)
await page.evaluate(() => {
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
await wait(600)
await shot('s10-notes-empty')
await rect('notePoint1', page.getByLabel(/Point 1/))
await page.getByLabel(/Point 1/).fill('The internship route is a realistic first step abroad.')
await page.getByLabel(/Point 2/).fill('Start your visa and housing paperwork a semester early.')
await page.getByLabel(/Point 3/).fill('Alumni networks help the most in your first month.')
await wait(1900)
await shot('s11-notes-filled')
// finish everything
await page.goto(`${BASE}/map`)
await wait(800)
for (const b of ['Stamp B1', 'Stamp B3', 'Stamp B4']) {
  await dev(b)
  await page.waitForURL('**/stamp/**', { timeout: 8000 })
  await wait(1200)
  await page.getByRole('button', { name: /Next booth|Back to map/ }).click()
  await page.waitForURL('**/map')
}
await dev('Auto-fill notes')
await page.getByRole('button', { name: 'Passport', exact: true }).click()
await wait(1200)
await page.evaluate(() => {
  const sc = document.querySelector('[data-page="passport"]')
  if (sc) sc.scrollTop = 250
  window.scrollTo(0, 0)
})
await wait(500)
await shot('s12-passport')
await rect('answerSubmit', page.getByRole('button', { name: /Answer & submit/ }))
await page.getByRole('button', { name: /Answer & submit/ }).click()
await wait(1500)
await shot('s13-exit')
await page.getByRole('radio').nth(4).click()
await wait(650)
await page.getByRole('radio').nth(3).click()
await wait(650)
await shot('s14-exit-text')
await page.getByRole('button', { name: 'Submit', exact: true }).click().catch(() => {})
await page.waitForURL('**/status', { timeout: 10000 }).catch(() => {})
await wait(2200)
await shot('s15-status')

writeFileSync(`${OUT}/rects.json`, JSON.stringify(rects, null, 2))
console.log(JSON.stringify(rects))
await browser.close()
