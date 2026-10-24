// Generates a random admin password + one PIN per booth. Hashes locally (bcrypt, verified by pgcrypto crypt()),
// writes only the hashes into an SQL file OUTSIDE the repo, and prints the plaintext ONCE.
// Usage: node scripts/gen-credentials.mjs <output.sql>
import bcrypt from 'bcryptjs'
import { randomInt } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'

const out = process.argv[2]
if (!out) throw new Error('usage: node scripts/gen-credentials.mjs <output.sql>')
const seed = JSON.parse(readFileSync('data/seed.json', 'utf8'))
const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
const password = Array.from({ length: 14 }, () => alphabet[randomInt(alphabet.length)]).join('')
const hash = (s) => bcrypt.hashSync(s, 10).replace(/^\$2b\$/, '$2a$')
const lines = [`insert into public.settings (key, value) values ('admin_password_hash', to_jsonb('${hash(password)}'::text)) on conflict (key) do update set value = excluded.value;`]
const pins = {}
for (const b of seed.booths) {
  const pin = String(randomInt(10000)).padStart(4, '0')
  pins[b.id] = pin
  lines.push(`insert into public.staff_pins (booth_id, pin_hash) values ('${b.id}', '${hash(pin)}') on conflict (booth_id) do update set pin_hash = excluded.pin_hash, failed_count = 0, locked_until = null;`)
}
writeFileSync(out, lines.join('\n') + '\n')
console.log(JSON.stringify({ adminPassword: password, staffPins: pins }))
