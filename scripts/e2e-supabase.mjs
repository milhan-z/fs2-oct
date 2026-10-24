// End-to-end test against the real Supabase backend (dev server in supabase mode).
// Test participants use NRP prefix 99990… — remove them afterwards with the cleanup SQL in README.
// Usage: FS2_ADMIN_PW=… FS2_STAFF_PIN=… FS2_PINS='{"B1":"…",…}' node scripts/e2e-supabase.mjs [baseUrl]
import { chromium } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import { mkdirSync, readFileSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:5174'
const OUT = 'test-results/e2e-supabase'
mkdirSync(OUT, { recursive: true })
const env = Object.fromEntries(
  readFileSync('.env.supabase.local', 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
)
const ADMIN_PW = process.env.FS2_ADMIN_PW
const STAFF_PIN = process.env.FS2_STAFF_PIN
const PINS = JSON.parse(process.env.FS2_PINS ?? '{}')
if (!ADMIN_PW || !PINS.B1 || !STAFF_PIN) throw new Error('set FS2_ADMIN_PW, FS2_PINS and FS2_STAFF_PIN')

let failures = 0
const ok = (c, label) => {
  console.log(`${c ? 'PASS' : 'FAIL'}  ${label}`)
  if (!c) failures++
}

// ---------------------------------------------------------------------------
// API-level: 10 sequential QR scans → one batch confirm
// ---------------------------------------------------------------------------
const sb = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const rpc = async (fn, args) => {
  const { data, error } = await sb.rpc(fn, args)
  if (error) throw new Error(`${fn}: ${error.message}`)
  return data
}
const admin = await rpc('admin_login', { p_password: ADMIN_PW })
ok(admin.ok, 'admin login (API)')
await rpc('admin_set_settings', { p_token: admin.token, p_settings: { simulationMode: true } })

const tokens = []
for (let i = 0; i < 10; i++) {
  const nrp = `99990000${String(i).padStart(2, '0')}`
  let r = await rpc('participant_register', { p_nrp: nrp, p_nama: `Uji Scan ${i + 1}`, p_departemen: 'Informatics', p_angkatan: '2024', p_pin: '1234' }).catch(() => null)
  if (!r) r = await rpc('participant_login', { p_nrp: nrp, p_pin: '1234' })
  const st = await rpc('get_my_state', { p_token: r.token })
  tokens.push(`FS2:${st.qrToken}`)
}
const staffT = (await rpc('staff_login', { p_slug: 'germany', p_pin: PINS.B3 })).token
const t0 = Date.now()
const resolved = []
for (const t of tokens) resolved.push(...(await rpc('staff_resolve_tokens', { p_token: staffT, p_tokens: [t] })))
const n = await rpc('staff_confirm_batch', { p_token: staffT, p_participant_ids: resolved.filter((r) => r.kind === 'ok').map((r) => r.participantId) })
ok(resolved.length === 10 && n === resolved.filter((r) => r.kind === 'ok').length, `10 scans resolved + batch confirmed (${n} new) in ${Date.now() - t0} ms`)
const again = await rpc('staff_resolve_tokens', { p_token: staffT, p_tokens: tokens.slice(0, 3) })
ok(again.every((r) => r.kind === 'duplicate'), 're-scan shows duplicates')

// ---------------------------------------------------------------------------
// UI: participant + staff + admin on the real backend
// ---------------------------------------------------------------------------
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, permissions: ['camera'], isMobile: true, hasTouch: true })
const page = await ctx.newPage()
const staff = await ctx.newPage()
const errors = []
for (const p of [page, staff]) {
  p.on('pageerror', (e) => errors.push(String(e)))
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
}
const shot = (p, n) => p.screenshot({ path: `${OUT}/${n}.png` })
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const NRP = '9999000099'

try {
  await page.goto(BASE)
  await page.evaluate(() => Object.keys(localStorage).forEach((k) => k.startsWith('fs2.') && localStorage.removeItem(k)))
  await page.goto(`${BASE}/signin`)
  await page.getByLabel('NRP', { exact: true }).fill(NRP)
  await page.getByRole('button', { name: 'Continue' }).click()
  const existing = await page.getByLabel('4-digit PIN').count().then(async (c) => c && (await page.getByLabel('Repeat PIN').count()) === 0)
  if (existing) {
    await page.getByLabel('4-digit PIN').fill('1234')
    await page.getByRole('button', { name: 'Open passport' }).click()
  } else {
    await page.getByLabel('Full name').fill('Peserta Uji Supabase')
    await page.getByLabel('Department').selectOption('Informatics')
    await page.getByLabel('4-digit PIN').fill('1234')
    await page.getByLabel('Repeat PIN').fill('1234')
    await page.getByRole('button', { name: 'Create passport' }).click()
  }
  await page.waitForURL(/\/(photo|map)/)
  if (page.url().endsWith('/photo')) {
    await page.getByRole('button', { name: 'Take photo' }).and(page.locator(':enabled')).click()
    await wait(600)
    await page.getByRole('button', { name: 'Use this photo' }).click()
    await page.waitForURL(/\/(onboarding|map)/, { timeout: 20000 })
    ok(true, 'photo uploaded via signed URL')
    if (page.url().includes('onboarding')) await page.getByRole('button', { name: 'Skip' }).click()
  }
  await page.waitForURL('**/map')
  await wait(800)
  await shot(page, '01-peta')
  await page.getByRole('button', { name: 'QR', exact: true }).click()
  await wait(800)
  await shot(page, '02-qr')

  for (const [i, b] of [['B1', 'korea'], ['B2', 'taiwan'], ['B3', 'germany'], ['B4', 'booth-4']].entries()) {
    if (i === 0) {
      // one shared staff PIN, then the runner just switches booths
      await staff.goto(`${BASE}/staff`)
      await staff.getByLabel('Staff PIN').fill(STAFF_PIN)
      await staff.getByRole('button', { name: 'Sign in' }).click()
      await staff.getByRole('heading', { name: /Which booth/ }).waitFor()
      ok(true, 'shared staff PIN sign-in')
    }
    await staff.goto(`${BASE}/staff/${b[1]}`)
    await staff.getByRole('heading', { name: 'Rapid scan' }).waitFor()
    await staff.getByRole('button', { name: /Manual entry/ }).click()
    await staff.getByLabel('Last 4 digits of NRP').fill(NRP.slice(-4))
    await staff.getByRole('button', { name: 'Search' }).click()
    await staff.getByRole('button', { name: /Peserta Uji Supabase/ }).click()
    await wait(300)
    if (i === 0) await shot(staff, '03-staff-queue')
    const t = Date.now()
    await staff.getByRole('button', { name: /Confirm all \(1\)/ }).click()
    if (i === 0) {
      await page.waitForURL('**/stamp/B1', { timeout: 8000 })
      ok(Date.now() - t <= 5500, `stamp appears on participant phone in ${Date.now() - t} ms (≤5 s)`)
      await wait(1500)
      await shot(page, '04-cap')
      await page.getByRole('button', { name: 'Write now' }).click()
      await page.getByLabel(/Point 1/).fill('Persiapan berkas sebaiknya dimulai satu semester sebelumnya.')
      await page.getByLabel(/Point 2/).fill('Adaptasi budaya akademik ternyata lebih penting dari bahasa.')
      await page.getByLabel(/Point 3/).fill('Jaringan alumni membantu banyak saat pertama kali tiba.')
      await page.getByText(/Autosaved/).waitFor({ timeout: 8000 })
      await page.reload()
      await wait(1500)
      ok((await page.getByLabel(/Point 3/).inputValue()).startsWith('Jaringan alumni'), 'resume survives reload (server copy)')
      await page.goto(`${BASE}/qr`)
    } else {
      await page.waitForURL(`**/stamp/${b[0]}`, { timeout: 8000 })
      await wait(1300)
      await page.goto(`${BASE}/visa/${b[0]}`)
      for (const k of [1, 2, 3]) await page.getByLabel(new RegExp(`Point ${k}`)).fill(`Poin ke ${k} dari booth ${b[1]} cukup panjang.`)
      await page.getByText(/Autosaved/).waitFor({ timeout: 8000 })
      if (i < 3) await page.goto(`${BASE}/qr`)
    }
  }
  await shot(staff, '05-staff-history')

  await page.goto(`${BASE}/exit`)
  await page.getByRole('radio').nth(4).click()
  await page.getByRole('radio').nth(8).click()
  await wait(1200)
  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  await page.waitForURL('**/status', { timeout: 10000 })
  await wait(800)
  await shot(page, '06-status')
  ok(await page.getByText('AWAITING REVIEW', { exact: true }).isVisible(), 'submission sent')

  // admin
  const adminPage = await ctx.newPage()
  await adminPage.setViewportSize({ width: 1280, height: 800 })
  await adminPage.goto(`${BASE}/admin`)
  await adminPage.getByLabel('Password').fill(ADMIN_PW)
  await adminPage.getByRole('button', { name: 'Sign in' }).click()
  await adminPage.getByRole('link', { name: /Submissions/ }).click()
  await adminPage.getByRole('button', { name: /Peserta Uji Supabase/ }).click()
  await wait(1500)
  const img = adminPage.getByAltText(/Attendance photo of Peserta Uji Supabase/)
  ok((await img.getAttribute('src'))?.includes('/storage/v1/object/sign/attendance-photos/'), 'admin sees attendance photo via signed URL')
  await shot(adminPage, '07-admin-detail')
  await adminPage.getByRole('button', { name: 'Approve' }).click()
  await wait(800)
  await adminPage.getByRole('checkbox', { name: /Stamp4It/ }).check()
  await wait(800)
  await page.getByRole('button', { name: 'Refresh' }).click().catch(() => {})
  await wait(1200)
  ok(await page.getByText('APPROVED', { exact: true }).isVisible(), 'participant sees approval')
  await adminPage.getByRole('link', { name: 'Export' }).click()
  const dl = adminPage.waitForEvent('download')
  await adminPage.getByRole('button', { name: 'Download XLSX' }).click()
  const file = await dl
  ok(file.suggestedFilename().endsWith('.xlsx'), `XLSX export (${file.suggestedFilename()})`)
} catch (e) {
  console.log('FAILED at', page.url(), String(e).split('\n')[0])
  failures++
  await shot(page, 'zz-failure').catch(() => {})
  await shot(staff, 'zz-failure-staff').catch(() => {})
} finally {
  await rpc('admin_set_settings', { p_token: admin.token, p_settings: { simulationMode: false } })
  await browser.close()
}

console.log(errors.length ? `CONSOLE ERRORS:\n${errors.join('\n')}` : 'no console errors')
console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED')
process.exit(failures ? 1 : 0)
