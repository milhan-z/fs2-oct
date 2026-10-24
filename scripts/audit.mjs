// UI audit recorder: walks the participant flow at 390×844 (mock mode), records a video and
// grabs a frame roughly every 100 ms during each transition. Output: docs/audit/<run>/...
// Usage: node scripts/audit.mjs [baseUrl] [runName]
import { chromium } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:5173'
const RUN = process.argv[3] ?? 'before'
const OUT = `docs/audit/${RUN}`
mkdirSync(`${OUT}/frames`, { recursive: true })
mkdirSync(`${OUT}/screens`, { recursive: true })
mkdirSync(`${OUT}/video`, { recursive: true })

const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 1,
  permissions: ['camera'],
  isMobile: true,
  hasTouch: true,
  recordVideo: { dir: `${OUT}/video`, size: { width: 390, height: 844 } },
})
const page = await ctx.newPage()
const A1_ONLY = process.env.A1_ONLY === '1'
const log = []
const notes = {}
const wait = (ms) => page.waitForTimeout(ms)
const screen = (name) => page.screenshot({ path: `${OUT}/screens/${name}.png` })

/** Fire `action`, then capture frames every ~100 ms for `ms`. */
async function transition(name, action, ms = 1200) {
  const dir = `${OUT}/frames/${name}`
  mkdirSync(dir, { recursive: true })
  const t0 = Date.now()
  await action()
  const stamps = []
  let i = 0
  while (Date.now() - t0 < ms) {
    const t = Date.now() - t0
    await page.screenshot({ path: `${dir}/${String(i).padStart(2, '0')}-${t}ms.png` })
    stamps.push(t)
    i++
    const next = t0 + i * 100
    const delay = next - Date.now()
    if (delay > 0) await wait(delay)
  }
  log.push({ name, frames: stamps.length, url: page.url() })
}
const dev = async (label) => {
  await page.getByRole('button', { name: 'DEV', exact: true }).click()
  await page.getByRole('button', { name: label, exact: true }).click()
  await page.getByRole('button', { name: 'DEV', exact: true }).click()
}

try {
  if (A1_ONLY) throw new Error('skip main flow')
  await page.goto(`${BASE}/?dev=1`)
  await page.evaluate(() => Object.keys(localStorage).forEach((k) => k.startsWith('fs2.') && localStorage.removeItem(k)))
  await page.goto(`${BASE}/?dev=1`)
  await wait(2800)
  await screen('01-cover')

  await transition('t01-cover-to-signin', () => page.getByRole('button', { name: 'Open Passport' }).click(), 1600)
  await screen('02-signin')
  await page.getByLabel('NRP', { exact: true }).fill('5025240028')
  await transition('t02-signin-nrp-to-register', () => page.getByRole('button', { name: 'Continue' }).click(), 600)
  await page.getByLabel('Full name').fill('Peserta Demo')
  await page.getByLabel('Department').selectOption('Informatics')
  await page.getByLabel('4-digit PIN').fill('1234')
  await page.getByLabel('Repeat PIN').fill('1234')
  await screen('03-register')
  await transition('t03-register-to-photo', () => page.getByRole('button', { name: 'Create passport' }).click(), 1200)
  await page.getByRole('dialog', { name: 'Attendance photo camera' }).waitFor({ timeout: 4000 })
  await wait(900)
  await screen('04-photo')
  await transition('t04-photo-capture', () => page.getByRole('button', { name: 'Take photo' }).click(), 1000)
  await screen('05-photo-taken')
  await transition('t05-photo-use-to-onboarding', () => page.getByRole('button', { name: 'Use this photo' }).click(), 2200)
  // onboarding is ~6 s; sample every 100 ms for the whole story
  await transition('t06-onboarding', async () => {}, 6200)
  await screen('06-onboarding-card')
  await transition('t07-onboarding-to-map', () => page.getByRole('button', { name: 'Start' }).click(), 900)
  await wait(400)
  await screen('07-map')
  await page.getByRole('button', { name: 'Skip tour' }).click({ timeout: 5000 }).catch(() => {})
  await transition('t08-map-lounge-to-building', () => page.getByRole('tab', { name: 'Whole building' }).click(), 700)
  await screen('08-map-building')
  await page.getByRole('tab', { name: 'Lounge' }).click()
  await wait(600)
  await transition('t09-pin-to-popup', () => page.getByRole('button', { name: /Taiwan booth/ }).click(), 900)
  await screen('09-popup')
  notes.popupStamp = await page.evaluate(() => {
    const img = document.querySelector('[role="dialog"] img[alt$="stamp"]')
    return img ? { src: img.getAttribute('src'), w: img.clientWidth, h: img.clientHeight, natural: img.naturalWidth, opacity: getComputedStyle(img).opacity, filter: getComputedStyle(img).filter } : null
  })
  await transition('t10-popup-close', () => page.getByRole('button', { name: 'Close', exact: true }).click(), 700)
  await transition('t11-map-to-qr', () => page.getByRole('button', { name: 'QR', exact: true }).click(), 800)
  await screen('10-qr')
  await transition('t12-stamp-moment', () => dev('Stamp B2'), 5500)
  await screen('11-stamp')
  await transition('t13-stamp-to-resume', () => page.getByRole('button', { name: 'Write now' }).click(), 700)
  await screen('12-resume')
  await page.getByLabel(/Point 1/).fill('The international internship route is a realistic first step abroad.')
  await wait(1800)
  await screen('12b-resume-saved')
  await transition('t14-resume-close', () => page.getByRole('button', { name: 'Done' }).click(), 800)
  await transition('t14b-map-to-passport', () => page.getByRole('button', { name: 'Passport', exact: true }).click(), 900)
  await screen('13-passport')
  await page.screenshot({ path: `${OUT}/screens/13b-passport-full.png`, fullPage: true })
  for (const b of ['Stamp B1', 'Stamp B3', 'Stamp B4']) {
    await dev(b)
    await page.waitForURL('**/stamp/**', { timeout: 8000 })
    await wait(1500)
    await page.getByRole('button', { name: /Next booth|Back to map/ }).click()
    await page.waitForURL('**/map')
  }
  await dev('Auto-fill notes')
  await page.getByRole('button', { name: 'Passport', exact: true }).click()
  await wait(700)
  await transition('t15-passport-to-exit', () => page.getByRole('button', { name: /Answer & submit/ }).click(), 800)
  await page.getByRole('radio').nth(4).click()
  await wait(600)
  await page.getByRole('radio').nth(3).click()
  await wait(600)
  await wait(500)
  await screen('14-exit')
  await page.screenshot({ path: `${OUT}/screens/14b-exit-full.png`, fullPage: true })
  await transition('t16-submit-to-status', () => page.getByRole('button', { name: 'Submit', exact: true }).click(), 3200)
  await screen('15-status')

  // A3: open a deep route directly (fresh load)
  await transition('t17-direct-load-passport', () => page.goto(`${BASE}/passport`), 2500)
  await transition('t18-direct-load-qr', () => page.goto(`${BASE}/qr`), 2500)
} catch (e) {
  console.log('FAILED at', page.url(), String(e).split('\n')[0])
  await screen('zz-failure')
}
await ctx.close()

// A1: no camera available → what can the participant do?
const ctx2 = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true })
// simulate a denied camera permission (in-app browsers, old phones)
await ctx2.addInitScript(() => {
  navigator.mediaDevices.getUserMedia = () => Promise.reject(new DOMException('Permission denied', 'NotAllowedError'))
})
const p2 = await ctx2.newPage()
try {
  await p2.goto(`${BASE}/?dev=1`)
  await p2.evaluate(() => Object.keys(localStorage).forEach((k) => k.startsWith('fs2.') && localStorage.removeItem(k)))
  await p2.goto(`${BASE}/signin`)
  await p2.getByLabel('NRP', { exact: true }).fill('5025249999')
  await p2.getByRole('button', { name: 'Continue' }).click()
  await p2.getByLabel('Full name').fill('No Camera Test')
  await p2.getByLabel('Department').selectOption('Informatics')
  await p2.getByLabel('4-digit PIN').fill('1234')
  await p2.getByLabel('Repeat PIN').fill('1234')
  await p2.getByRole('button', { name: 'Create passport' }).click()
  await p2.waitForURL('**/photo')
  await p2.waitForTimeout(3000)
  await p2.screenshot({ path: `${OUT}/screens/a1-no-camera.png` })
  notes.a1 = await p2.evaluate(() => ({
    buttons: [...document.querySelectorAll('button')].map((b) => b.textContent?.trim()).filter(Boolean),
    fileInput: !!document.querySelector('input[type=file]'),
    fileInputVisible: (() => {
      const f = document.querySelector('input[type=file]')
      return f ? getComputedStyle(f).display !== 'none' && f.getBoundingClientRect().width > 0 : false
    })(),
    message: document.querySelector('main')?.innerText.match(/Camera[^\n]*/)?.[0] ?? null,
  }))
  // try the file fallback path with a generated JPEG
  const jpeg = await p2.evaluate(async () => {
    const c = document.createElement('canvas')
    c.width = c.height = 600
    const g = c.getContext('2d')
    g.fillStyle = '#c96'
    g.fillRect(0, 0, 600, 600)
    return c.toDataURL('image/jpeg', 0.9).split(',')[1]
  })
  const input = p2.locator('input[type=file]')
  if (await input.count()) {
    await input.setInputFiles({ name: 'selfie.jpg', mimeType: 'image/jpeg', buffer: Buffer.from(jpeg, 'base64') })
    await p2.waitForTimeout(800)
    await p2.screenshot({ path: `${OUT}/screens/a1-after-file.png` })
    const use = p2.getByRole('button', { name: 'Use this photo' })
    if (await use.count()) {
      await use.click()
      await p2.waitForTimeout(3500)
      notes.a1.afterUseUrl = p2.url()
      notes.a1.error = await p2.locator('[role=alert]').allInnerTexts()
      await p2.screenshot({ path: `${OUT}/screens/a1-after-use.png` })
    }
  }
} catch (e) {
  notes.a1err = String(e).split('\n')[0]
}
await ctx2.close()
await browser.close()

writeFileSync(`${OUT}/${A1_ONLY ? 'log-a1' : 'log'}.json`, JSON.stringify({ log, notes }, null, 2))
console.log(JSON.stringify({ log, notes }, null, 2))
