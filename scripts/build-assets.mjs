// Compresses stamp PNGs into web-sized WebP (small for lists, large for the stamp moment).
import sharp from 'sharp'
import { readdirSync, mkdirSync } from 'node:fs'
import { join, parse } from 'node:path'

const src = 'assets/stamps'
const out = 'public/assets/stamps'
mkdirSync(out, { recursive: true })
for (const file of readdirSync(src).filter((f) => f.endsWith('.png'))) {
  const { name } = parse(file)
  await sharp(join(src, file)).resize(320).webp({ quality: 70, alphaQuality: 80 }).toFile(join(out, `${name}.webp`))
  await sharp(join(src, file)).resize(720).webp({ quality: 72, alphaQuality: 80 }).toFile(join(out, `${name}-lg.webp`))
  console.log('stamp', name)
}
