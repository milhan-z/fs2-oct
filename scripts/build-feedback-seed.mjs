// Rebuilds `feedback` in data/seed.json from the committee's Google Form
// (FS2 Feedback Form by ID): 5 material questions + 4 questions per booth speaker.
// The identity questions of the form (name, NRP, degree, batch, department, faculty) are not repeated: the
// passport already knows them. Run: node scripts/build-feedback-seed.mjs  (then `npm run seed:sql`)
import { readFileSync, writeFileSync } from 'node:fs'

const seed = JSON.parse(readFileSync('data/seed.json', 'utf8'))
const POOR = ['Poor', 'Excellent']
const AGREE = ['Strongly disagree', 'Strongly agree']

const q = (id, teks, tipe, wajib, section, labels) => ({
  id,
  teks,
  tipe,
  wajib,
  section,
  ...(labels ? { labelLow: labels[0], labelHigh: labels[1] } : {}),
  placeholder: false,
})

const out = [
  q('m1', 'Completeness and Clarity of Material', 'skala_1_5', true, 'Material feedback', POOR),
  q('m2', 'The Material is Easy to Understand', 'skala_1_5', true, 'Material feedback', AGREE),
  q('m3', 'Benefit from the Material', 'skala_1_5', true, 'Material feedback', POOR),
  q('m4', 'Material Quality', 'skala_1_5', true, 'Material feedback', POOR),
  q('m5', 'Criticism and Suggestions for Material', 'teks', true, 'Material feedback'),
]
// questions are keyed by booth id (b4-…), so a booth keeps its answers whatever its position in the list; the heading
// number follows the booth order of the event.
seed.booths.forEach((b, i) => {
  const s = b.pemateri?.[0]
  const who = s && s.nama !== 'Speaker TBA' ? `${s.nama} · ${b.nama}` : `${b.nama} · speaker to be announced`
  const section = `Speaker #${i + 1} · ${who}`
  const k = b.id.toLowerCase()
  out.push(
    q(`${k}-presentation`, 'Way of Presentation', 'skala_1_5', false, section, POOR),
    q(`${k}-scope`, 'Clearly Defined Content Scope', 'skala_1_5', false, section, POOR),
    q(`${k}-interactive`, 'Interactive Presentation', 'skala_1_5', false, section, POOR),
    q(`${k}-time`, 'Effective and Efficient Use of Time', 'skala_1_5', false, section, POOR),
  )
})
seed.feedback = out
writeFileSync('data/seed.json', JSON.stringify(seed, null, 2) + '\n')
console.log(out.length, 'questions')
