// Deterministic renderer: seeks index.html frame by frame (Playwright) and pipes PNGs to ffmpeg.
//   node video/render.mjs stills <ar:v|h> <t1,t2,...> <outDir>
//   node video/render.mjs video  <ar:v|h> <out.mp4> [audio.wav]
// Env: FFMPEG = path to the ffmpeg binary.
import { chromium } from '@playwright/test'
import { spawn } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const [mode, ar, a3, a4] = process.argv.slice(2)
const FFMPEG = process.env.FFMPEG || 'ffmpeg'
const [W, H] = ar === 'h' ? [1920, 1080] : [1080, 1920]

// another film: HTML=video/committee/index.html CUES=video/committee/cues.json RECTS=video/committee/shots/rects.json
const HTML = process.env.HTML || 'video/index.html'
const cues = JSON.parse(readFileSync(process.env.CUES || 'video/cues.json', 'utf8'))
const rects = JSON.parse(readFileSync(process.env.RECTS || 'video/shots/rects.json', 'utf8'))
// the page reads cues.js next to it
writeFileSync(path.join(path.dirname(HTML), 'cues.js'), `const CUES = ${JSON.stringify(cues)}\nconst SHOTS_RECTS = ${JSON.stringify(rects)}\n`)

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: W, height: H } })
page.on('pageerror', (e) => console.error('PAGEERROR', e.message))
await page.goto('file://' + path.resolve(HTML) + `?w=${W}&h=${H}`)
await page.waitForFunction(() => window.seek && window.READY)
await page.evaluate(() => window.READY)

if (mode === 'stills') {
  mkdirSync(a4, { recursive: true })
  for (const t of a3.split(',').map(Number)) {
    await page.evaluate((x) => window.seek(x), t)
    await page.screenshot({ path: `${a4}/${ar}-${String(t).replace('.', '_')}.png` })
  }
} else {
  const out = a3
  const audio = a4
  const { DURATION, FPS } = await page.evaluate(() => ({ DURATION: window.DURATION, FPS: window.FPS }))
  const args = ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-i', '-']
  if (audio) args.push('-i', audio)
  args.push('-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-maxrate', '9M', '-bufsize', '18M', '-pix_fmt', 'yuv420p', '-movflags', '+faststart')
  if (audio) args.push('-c:a', 'aac', '-b:a', '192k', '-shortest')
  args.push(out)
  const ff = spawn(FFMPEG, args, { stdio: ['pipe', 'inherit', 'inherit'] })
  const N = Math.round(DURATION * FPS)
  for (let i = 0; i < N; i++) {
    await page.evaluate((x) => window.seek(x), i / FPS)
    const png = await page.screenshot({ type: 'png' })
    if (!ff.stdin.write(png)) await new Promise((r) => ff.stdin.once('drain', r))
    if (i % 90 === 0) console.log(`frame ${i}/${N}`)
  }
  ff.stdin.end()
  await new Promise((r) => ff.on('close', r))
}
await browser.close()
