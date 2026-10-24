// Screenshots the main participant pages at small and large phone sizes (mock mode).
// Usage: node scripts/viewports.mjs [baseUrl] [outDir]
import { chromium } from '@playwright/test'
import { mkdirSync } from 'node:fs'

const BASE = process.argv[2] ?? 'http://localhost:5173'
const OUT = process.argv[3] ?? 'docs/audit/after/viewports'
mkdirSync(OUT, { recursive: true })
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] })
for (const [w, h] of [
  [360, 740],
  [430, 932],
]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, permissions: ['camera'], isMobile: true, hasTouch: true })
  const page = await ctx.newPage()
  const shot = (n) => page.screenshot({ path: `${OUT}/${w}x${h}-${n}.png` })
  await page.goto(`${BASE}/`)
  await page.evaluate(() => Object.keys(localStorage).forEach((k) => k.startsWith('fs2.') && localStorage.removeItem(k)))
  await page.goto(`${BASE}/`)
  await page.waitForTimeout(2600)
  const overflow = await page.evaluate(() => [document.documentElement.scrollHeight > innerHeight, document.documentElement.scrollWidth > innerWidth])
  console.log(`${w}x${h} cover overflow (y,x):`, overflow)
  await shot('01-cover')
  await page.getByRole('button', { name: 'Open Passport' }).click()
  await page.waitForTimeout(1300)
  await page.getByLabel('NRP', { exact: true }).fill(`50252400${w}`.slice(0, 10))
  await page.getByRole('button', { name: 'Continue' }).click()
  await page.getByLabel('Full name').fill('Viewport Test')
  await page.getByLabel('Department').selectOption('Informatics')
  await page.getByLabel('4-digit PIN').fill('1234')
  await page.getByLabel('Repeat PIN').fill('1234')
  await shot('02-register')
  await page.getByRole('button', { name: 'Create passport' }).click()
  await page.waitForURL('**/photo')
  await page.waitForTimeout(1200)
  await shot('03-photo')
  await page.getByRole('button', { name: 'Use sample photo' }).click()
  await page.getByRole('button', { name: 'Use this photo' }).click()
  await page.waitForURL('**/onboarding')
  await page.getByRole('button', { name: 'Skip' }).click()
  await page.waitForURL('**/map')
  await page.waitForTimeout(1600)
  await shot('04-map')
  await page.getByRole('button', { name: 'Passport', exact: true }).click()
  await page.waitForTimeout(900)
  await shot('05-passport')
  await page.getByRole('button', { name: 'QR', exact: true }).click()
  await page.waitForTimeout(900)
  await shot('06-qr')
  await ctx.close()
}
await browser.close()
