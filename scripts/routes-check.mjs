// Walks every route of the app (participant, staff, admin) at phone widths (and admin on desktop) and reports what
// would hurt on the day: page errors, failed requests, blank screens and anything wider than the screen.
// Mock mode against a production build:  VITE_DATA_MODE=mock npm run build && npx vite preview --port 4173
//   node scripts/routes-check.mjs http://localhost:4173
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:4173'
const OUT = 'test-results/routes'
mkdirSync(OUT, { recursive: true })
const problems = []
let checked = 0

const fakeCamera = () => {
  navigator.mediaDevices.getUserMedia = async () => {
    const c = document.createElement('canvas')
    c.width = 720
    c.height = 960
    const g = c.getContext('2d')
    const draw = () => {
      g.fillStyle = '#556'
      g.fillRect(0, 0, 720, 960)
      g.fillStyle = '#dcc'
      g.beginPath()
      g.arc(360, 380, 150, 0, 7)
      g.fill()
      g.fillRect(200, 560, 320, 400)
    }
    draw()
    setInterval(draw, 100)
    return c.captureStream(15)
  }
}

/** anything that sticks out of the screen sideways without a scroller of its own around it */
const overflowReport = () => {
  const vw = document.documentElement.clientWidth
  const clipped = (e) => {
    for (let n = e.parentElement; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
      const o = getComputedStyle(n).overflowX
      if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true
    }
    return false
  }
  const out = []
  for (const e of document.querySelectorAll('body *')) {
    const r = e.getBoundingClientRect()
    if (!r.width || !r.height) continue
    if ((r.right > vw + 1 || r.left < -1) && !clipped(e)) {
      const cs = getComputedStyle(e)
      if (cs.position === 'fixed' && cs.pointerEvents === 'none') continue
      out.push(`${e.tagName.toLowerCase()}${e.className && typeof e.className === 'string' ? '.' + e.className.split(' ').slice(0, 3).join('.') : ''} [${Math.round(r.left)}..${Math.round(r.right)}]`)
    }
  }
  const scrollers = [...document.querySelectorAll('[data-page], [role="dialog"]')].filter((e) => e.scrollWidth > e.clientWidth + 1).map((e) => `scroller ${e.getAttribute('data-page') ?? 'dialog'} ${e.scrollWidth}>${e.clientWidth}`)
  const mp = document.querySelector('[data-page="map"]')
  return { mapScroll: mp ? mp.scrollHeight - mp.clientHeight : 0, vw, doc: document.documentElement.scrollWidth - vw, body: document.body.scrollWidth - vw, off: out.slice(0, 6), scrollers, text: document.body.innerText.trim().length }
}

async function visit(page, label, path, { wait = 1500, shot = false } = {}) {
  const errs = []
  const onErr = (e) => errs.push('PAGEERROR ' + e.message)
  const onFail = (r) => {
    const u = r.url()
    if (!u.includes('hkwylhvxxemminnbzlcd') && r.status() >= 400 && !u.endsWith('/sw.js')) errs.push(`HTTP ${r.status()} ${u.replace(BASE, '')}`)
  }
  const onCon = (m) => m.type() === 'error' && !/Failed to load resource|favicon/.test(m.text()) && errs.push('console: ' + m.text().slice(0, 140))
  page.on('pageerror', onErr)
  page.on('response', onFail)
  page.on('console', onCon)
  await page.goto(BASE + path, { waitUntil: 'load' })
  await page.waitForTimeout(wait)
  const rep = await page.evaluate(overflowReport)
  page.off('pageerror', onErr)
  page.off('response', onFail)
  page.off('console', onCon)
  checked++
  const tag = `${label} ${path} @${rep.vw}`
  const bad = []
  if (rep.doc > 0 || rep.body > 0) bad.push(`page scrolls sideways by ${Math.max(rep.doc, rep.body)}px`)
  if (rep.off.length) bad.push('wider than screen: ' + rep.off.join(' | '))
  if (rep.scrollers.length) bad.push(rep.scrollers.join(', '))
  if (path.startsWith('/map') && rep.mapScroll > 1) bad.push(`the map page scrolls vertically by ${rep.mapScroll}px (it should be one full page)`)
  if (rep.text < 20) bad.push('looks blank')
  if (errs.length) bad.push(...errs)
  if (bad.length) problems.push(`${tag}\n    - ${bad.join('\n    - ')}`)
  console.log(`${bad.length ? 'FAIL' : 'ok  '} ${tag}`)
  if (shot) await page.screenshot({ path: `${OUT}/${label}-${path.replace(/\W+/g, '_') || 'root'}-${rep.vw}.png` })
}

const browser = await chromium.launch()
const dev = async (page, label) => {
  await page.getByRole('button', { name: 'DEV', exact: true }).click()
  await page.getByRole('button', { name: label, exact: true }).click()
  await page.getByRole('button', { name: 'DEV', exact: true }).click()
}

for (const [w, h] of [[360, 740], [390, 844], [430, 932]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: true, permissions: ['camera'] })
  await ctx.addInitScript(fakeCamera)
  const page = await ctx.newPage()
  console.log(`\n=== participant ${w}×${h}`)
  // before sign-in
  await page.goto(BASE + '/?dev=1')
  await page.evaluate(() => Object.keys(localStorage).forEach((k) => k.startsWith('fs2.') && localStorage.removeItem(k)))
  for (const p of ['/', '/signin', '/guide', '/map']) await visit(page, 'visitor', p)
  // sign up + photo
  await page.goto(BASE + '/signin?dev=1')
  await page.waitForTimeout(1500)
  await page.getByLabel('NRP', { exact: true }).fill('5025240028')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Full name').fill('Peserta Uji Panjang Sekali Namanya Untuk Cek Layout')
  await page.getByLabel('4-digit PIN').fill('1234')
  await page.getByLabel('Repeat PIN').fill('1234')
  await visit(page, 'register-form', '/signin?dev=1', { wait: 200 }).catch(() => {})
  await page.goto(BASE + '/signin?dev=1')
  await page.waitForTimeout(800)
  await page.getByLabel('NRP', { exact: true }).fill('5025240028')
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Full name').fill('Peserta Uji Panjang Sekali Namanya Untuk Cek Layout')
  await page.getByLabel('4-digit PIN').fill('1234')
  await page.getByLabel('Repeat PIN').fill('1234')
  const reg = await page.evaluate(overflowReport)
  if (reg.doc > 0 || reg.off.length) problems.push(`register form @${w}: ${reg.doc}px / ${reg.off.join(' | ')}`)
  await page.getByRole('button', { name: 'Create passport' }).click()
  await page.getByRole('dialog', { name: 'Attendance photo camera' }).waitFor({ timeout: 8000 })
  await page.waitForTimeout(1200)
  const cam = await page.evaluate(overflowReport)
  if (cam.doc > 0 || cam.off.length) problems.push(`camera @${w}: ${cam.doc}px / ${cam.off.join(' | ')}`)
  await page.getByRole('button', { name: 'Take photo' }).click()
  await page.getByRole('button', { name: 'Use this photo' }).click()
  await page.waitForTimeout(8500)
  await page.getByRole('button', { name: 'Start' }).click({ timeout: 4000 }).catch(() => {})
  await page.getByRole('button', { name: 'Skip tour' }).click({ timeout: 4000 }).catch(() => {})
  // routes with a session, nothing stamped yet
  for (const p of ['/map', '/qr', '/passport', '/exit', '/status', '/guide', '/photo?ulang=1', '/visa/B1', '/stamp/B1', '/nonexistent']) await visit(page, 'signed-in', p, { shot: w === 390 })
  if (w === 390) {
    // a full journey: stamps, notes, feedback, submit
    await page.goto(BASE + '/map?dev=1')
    await page.waitForTimeout(1500)
    for (const b of ['Stamp B1', 'Stamp B4', 'Stamp B5', 'Stamp B3']) {
      await dev(page, b)
      await page.waitForURL('**/stamp/**', { timeout: 8000 })
      await page.waitForTimeout(1200)
      await page.getByRole('button', { name: /Next booth|Back to map/ }).click()
      await page.waitForURL('**/map')
    }
    await dev(page, 'Auto-fill notes')
    for (const p of ['/map', '/qr', '/passport', '/visa/B1', '/exit']) await visit(page, 'after-stamps', p, { shot: true })
    await page.goto(BASE + '/exit?dev=1')
    await page.waitForTimeout(1500)
    for (let k = 0; k < 4; k++) {
      await page.getByRole('radio').nth(4).click()
      await page.waitForTimeout(650)
    }
    await page.getByLabel('Criticism and Suggestions for Material').fill('Semua booth sangat membantu, terima kasih.')
    await page.waitForTimeout(600)
    await page.getByRole('button', { name: 'Submit', exact: true }).click()
    await page.waitForURL('**/status', { timeout: 10000 })
    for (const p of ['/status', '/passport', '/exit']) await visit(page, 'submitted', p, { shot: true })
    // the committee side shares this browser's mock data: staff and admin
    for (const [aw, ah] of [[390, 844], [1280, 800]]) {
      const ap = await ctx.newPage()
      await ap.setViewportSize({ width: aw, height: ah })
      console.log(`\n=== staff + admin ${aw}×${ah}`)
      await visit(ap, 'staff-login', '/staff')
      if (await ap.locator('#staff-all-pin').count()) {
        await ap.fill('#staff-all-pin', '555555')
        await ap.click('button[type=submit]')
        await ap.waitForTimeout(1500)
      }
      await visit(ap, 'staff-home', '/staff', { wait: 800, shot: true })
      for (const s of ['korea', 'japan', 'taiwan-ntust', 'germany', 'taiwan']) await visit(ap, 'staff-booth', `/staff/${s}`, { wait: 1800, shot: aw === 390 && s === 'korea' })
      await visit(ap, 'staff-bad', '/staff/nope', { wait: 1200 })
      await visit(ap, 'admin-login', '/admin')
      if (await ap.locator('input[type=password]').count()) {
        await ap.fill('input[type=password]', 'fs2admin')
        await ap.keyboard.press('Enter')
        await ap.waitForTimeout(1500)
      }
      for (const s of ['', '/submissions', '/participants', '/content', '/settings', '/export']) await visit(ap, 'admin', `/admin${s}`, { wait: 1800, shot: true })
      await ap.close()
    }
  }
  await ctx.close()
}
await browser.close()
console.log(`\nchecked ${checked} pages`)
if (problems.length) {
  console.log(`\n${problems.length} PROBLEMS:\n` + problems.join('\n'))
  process.exitCode = 1
} else console.log('ALL ROUTES CLEAN')
