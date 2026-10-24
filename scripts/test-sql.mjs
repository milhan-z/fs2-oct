// Runs all migrations + seed on an in-process Postgres (PGlite) and exercises the RPC API end to end.
// Usage: node scripts/test-sql.mjs
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import { readdirSync, readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const db = new PGlite({ extensions: { pgcrypto } })
let failures = 0
const ok = (cond, label) => {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`)
  if (!cond) failures++
}
const one = async (sql, params = []) => (await db.query(sql, params)).rows[0]
const call = async (fn, args) => {
  const ph = args.map((_, i) => `$${i + 1}`).join(', ')
  const r = await one(`select public.${fn}(${ph}) as v`, args)
  return r.v
}
const expectErr = async (fn, args, code, label) => {
  try {
    await call(fn, args)
    ok(false, `${label} (no error)`)
  } catch (e) {
    ok(String(e.message).startsWith(`${code}:`), `${label} → ${e.message}`)
  }
}

// Supabase platform stubs
await db.exec(`
  create schema extensions;
  create role anon; create role authenticated; create role service_role;
  create schema storage;
  create table storage.buckets (id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
`)
for (const f of readdirSync('supabase/migrations').sort()) {
  await db.exec(readFileSync(join('supabase/migrations', f), 'utf8'))
  console.log('migrated', f)
}
await db.exec(readFileSync('supabase/seed.sql', 'utf8'))
const credFile = join(tmpdir(), 'fs2-test-creds.sql')
const creds = JSON.parse(execFileSync('node', ['scripts/gen-credentials.mjs', credFile]).toString())
await db.exec(readFileSync(credFile, 'utf8'))

// --- security: anon cannot touch tables or private helpers
const anonTable = await one(`select has_table_privilege('anon', 'public.participants', 'select') as v`)
ok(!anonTable.v, 'anon has no SELECT on participants')
const anonAuth = await one(`select has_table_privilege('anon', 'public.participant_auth', 'select') as v`)
ok(!anonAuth.v, 'anon has no SELECT on participant_auth')
const rls = await one(`select count(*)::int as n from pg_tables where schemaname = 'public' and not rowsecurity`)
ok(rls.n === 0, 'RLS on for every public table')
const pol = await one(`select count(*)::int as n from pg_policies where schemaname = 'public'`)
ok(pol.n === 0, 'no RLS policies')
const helper = await one(`select has_function_privilege('anon', 'private.my_state(uuid)', 'execute') as v`)
ok(!helper.v, 'anon cannot execute private helpers')
const edge = await one(`select has_function_privilege('anon', 'public.edge_session(text)', 'execute') as v`)
ok(!edge.v, 'anon cannot execute edge_session')
const api = await one(`select has_function_privilege('anon', 'public.get_my_state(text)', 'execute') as v`)
ok(api.v, 'anon can execute get_my_state')

// --- content
const content = await call('get_content', [])
ok(content.booths.length === 4 && content.speakers.length === 4 && content.questions.length === 3, 'get_content returns seed')
ok(!JSON.stringify(content).includes('admin_password_hash') && !JSON.stringify(content).includes('$2a$'), 'content has no secrets')

// --- participant
ok((await call('check_nrp', ['5025240028'])) === false, 'check_nrp false for new NRP')
const reg = await call('participant_register', ['5025240028', 'Peserta Demo', 'Teknik Informatika', '2024', '1234'])
ok(reg.ok && reg.token.length === 64, 'register returns session token')
await expectErr('participant_register', ['5025240028', 'X Y Z', 'TI', '2024', '1234'], 'exists', 'duplicate NRP rejected')
const pt = reg.token
const auth = await one(`select pin_hash from public.participant_auth limit 1`)
ok(auth.pin_hash.startsWith('$2a$') && !auth.pin_hash.includes('1234'), 'PIN stored as bcrypt hash')
const sess = await one(`select token_hash from public.sessions limit 1`)
ok(sess.token_hash !== pt, 'session stores only token hash')

for (let i = 0; i < 4; i++) {
  const r = await call('participant_login', ['5025240028', '0000'])
  ok(!r.ok && r.error === 'bad_pin', `wrong PIN #${i + 1} rejected`)
}
const r5 = await call('participant_login', ['5025240028', '0000'])
ok(!r5.ok, 'wrong PIN #5 rejected')
const r6 = await call('participant_login', ['5025240028', '1234'])
ok(!r6.ok && r6.error === 'locked', 'locked after 5 failures even with correct PIN')
await db.exec(`update public.participant_auth set locked_until = null`)
const good = await call('participant_login', ['5025240028', '1234'])
ok(good.ok, 'login works after lock expires')

let st = await call('get_my_state', [pt])
ok(st.participant.nrpMasked === '••••0028' && st.visits.length === 0 && st.qrToken.length === 36, 'get_my_state')
await expectErr('get_my_state', ['bogus'], 'auth', 'bad token rejected')
await expectErr('save_resume', [pt, 'B1', 'a', 'b', 'c'], 'not_stamped', 'resume needs stamp')

// --- staff
const badStaff = await call('staff_login', ['korea', '9999'])
ok(!badStaff.ok, 'wrong staff PIN rejected')
const staff = await call('staff_login', ['korea', creds.staffPins.B1])
ok(staff.ok && staff.boothId === 'B1', 'staff login')
const stt = staff.token
const resolved = await call('staff_resolve_tokens', [stt, [`FS2:${st.qrToken}`, 'FS2:nope', 'random']])
ok(resolved[0].kind === 'ok' && resolved[1].kind === 'unknown' && resolved[2].kind === 'unknown', 'resolve tokens ok/unknown')
ok(!JSON.stringify(resolved).includes('5025240028'), 'resolve hides full NRP')
await expectErr('staff_confirm_batch', [stt, [st.participant.id]], 'closed', 'confirm blocked outside session window')
await db.exec(`update public.settings set value = 'true'::jsonb where key = 'simulation_mode'`)
ok((await call('staff_confirm_batch', [stt, [st.participant.id, st.participant.id]])) === 1, 'confirm batch (dedup in batch)')
ok((await call('staff_confirm_batch', [stt, [st.participant.id]])) === 0, 'second confirm ignored')
const dup = await call('staff_resolve_tokens', [stt, [`FS2:${st.qrToken}`]])
ok(dup[0].kind === 'duplicate', 'resolve marks duplicate')
const manual = await call('staff_find_by_last4', [stt, '0028'])
ok(manual.length === 1, 'manual last-4 lookup')
const hist = await call('staff_history', [stt])
ok(hist.length === 1, 'staff history')
await call('staff_cancel_visit', [stt, hist[0].visitId])
st = await call('get_my_state', [pt])
ok(st.visits.length === 0, 'cancel removes stamp')

// stamp all 4 booths
for (const b of ['B1', 'B2', 'B3', 'B4']) {
  const s = await call('staff_login', [content.booths.find((x) => x.id === b).slug, creds.staffPins[b]])
  await call('staff_confirm_batch', [s.token, [st.participant.id]])
}
st = await call('get_my_state', [pt])
ok(st.visits.length === 4, '4 booths stamped')

await expectErr('submit', [pt], 'incomplete', 'submit blocked without resumes')
const long = 'Ini adalah poin yang cukup panjang sekali.'
for (const b of ['B1', 'B2', 'B3', 'B4']) await call('save_resume', [pt, b, long, long, b === 'B4' ? 'pendek' : long])
await expectErr('submit', [pt], 'incomplete', 'submit blocked with short point')
await call('save_resume', [pt, 'B4', long, long, long])
await expectErr('submit', [pt], 'incomplete', 'submit blocked without feedback')
await call('save_feedback', [pt, JSON.stringify([{ questionId: 'q1', nilaiInt: 5 }, { questionId: 'q2', nilaiInt: 4 }, { questionId: 'q3', nilaiTeks: 'Mantap' }])])
await call('submit', [pt])
st = await call('get_my_state', [pt])
ok(st.submission.status === 'submitted' && st.submission.code === 'FS2-0028-A', 'submitted with code FS2-0028-A')
await expectErr('save_resume', [pt, 'B1', 'x', 'y', 'z'], 'locked', 'resume locked after submit')
await expectErr('submit', [pt], 'locked', 'double submit rejected')

// --- admin
const badAdmin = await call('admin_login', ['nope'])
ok(!badAdmin.ok, 'wrong admin password rejected')
const adm = await call('admin_login', [creds.adminPassword])
ok(adm.ok, 'admin login')
const at = adm.token
await expectErr('admin_dashboard', [pt], 'auth', 'participant token cannot use admin RPC')
const dash = await call('admin_dashboard', [at])
ok(dash.participants === 1 && dash.allFour === 1 && dash.submissions.submitted === 1, 'admin dashboard')
const subs = await call('admin_list_submissions', [at, 'submitted', ''])
ok(subs.length === 1, 'admin list submissions')
await expectErr('admin_review', [at, subs[0].submissionId, 'revision', ''], 'invalid', 'return needs note')
await call('admin_review', [at, subs[0].submissionId, 'revision', 'Poin B2 terlalu umum'])
st = await call('get_my_state', [pt])
ok(st.submission.status === 'revision' && st.submission.reviewerNote === 'Poin B2 terlalu umum', 'revision with note visible to participant')
await call('save_resume', [pt, 'B2', long, long, 'Poin baru yang lebih spesifik dan jelas.'])
await call('submit', [pt])
st = await call('get_my_state', [pt])
ok(st.submission.version === 2 && st.submission.code === 'FS2-0028-B', 'resubmit bumps version')
await call('admin_review', [at, subs[0].submissionId, 'approve', ''])
await call('admin_set_stamp4it', [at, st.participant.id, true])
st = await call('get_my_state', [pt])
ok(st.submission.status === 'approved' && st.stamp4it === true, 'approve + Stamp4It')
const newPin = await call('admin_reset_pin', [at, st.participant.id])
ok(/^\d{4}$/.test(newPin), 'reset PIN returns 4 digits')
await expectErr('get_my_state', [pt], 'auth', 'old participant session revoked after PIN reset')
ok((await call('participant_login', ['5025240028', newPin])).ok, 'login with new PIN')
await call('admin_upsert_booth', [at, JSON.stringify({ ...content.booths[0], x: 1000, y: 3000 })])
ok((await call('get_content', [])).booths[0].x === 1000, 'admin moves booth point')
await call('admin_set_settings', [at, JSON.stringify({ simulationMode: false })])
ok((await call('get_content', [])).settings.simulationMode === false, 'admin toggles simulation mode')
const raw = await call('admin_export_raw', [at])
const rawText = JSON.stringify(raw)
ok(raw.participants.length === 1 && raw.submissions.length === 1, 'export raw rows')
ok(!rawText.includes('$2a$') && !rawText.includes(st.qrToken) && !rawText.includes('photo'), 'export has no hash / QR token / photo path')
// --- shared staff (runner) PIN + booth switching
const master = await call('admin_reset_staff_master_pin', [at])
ok(/^\d{6}$/.test(master), 'shared staff PIN is 6 digits')
ok(!(await call('staff_login', ['', '000000'])).ok, 'wrong shared PIN rejected')
const root = await call('staff_login', ['', master])
ok(root.ok && root.roaming && !root.boothId, 'shared PIN opens a roaming session')
const sw = await call('staff_switch', [root.token, 'taiwan'])
ok(sw.boothId === 'B2' && (await call('staff_history', [sw.token])).length >= 0, 'runner switches to a booth and works there')
const viaBooth = await call('staff_login', ['germany', master])
ok(viaBooth.ok && viaBooth.boothId === 'B3', 'shared PIN also works on a booth link')
ok((await call('staff_switch', [viaBooth.token, 'korea'])).boothId === 'B1', 'switch from a booth session')
const boothOnly = await call('staff_login', ['korea', creds.staffPins.B1])
await expectErr('staff_switch', [boothOnly.token, 'taiwan'], 'auth', 'booth-only PIN cannot switch booths')

// --- admin edits / deletes a participant
await call('admin_update_participant', [at, st.participant.id, JSON.stringify({ nrp: '5025240099', nama: 'Peserta Diubah', departemen: 'Informatics', angkatan: '2023' })])
ok((await call('get_my_state', [(await call('participant_login', ['5025240099', newPin])).token])).participant.nama === 'Peserta Diubah', 'admin edits NRP / name')
const other = await call('participant_register', ['5025240111', 'Peserta Lain', 'Informatics', '2024', '1234'])
await expectErr('admin_update_participant', [at, st.participant.id, JSON.stringify({ nrp: '5025240111', nama: 'X Y Z', departemen: 'TI', angkatan: '' })], 'exists', 'edit rejects a taken NRP')
const otherId = (await call('get_my_state', [other.token])).participant.id
await call('admin_delete_participant', [at, otherId])
await expectErr('get_my_state', [other.token], 'auth', 'deleted participant is signed out')
ok((await one(`select count(*)::int as n from public.participants where id = $1`, [otherId])).n === 0, 'admin deletes participant')

// --- feedback questions: add / reorder / delete, any number
for (let i = 4; i <= 12; i++) await call('admin_upsert_question', [at, JSON.stringify({ id: `qx${i}`, teks: `Extra question number ${i}`, tipe: i % 2 ? 'teks' : 'skala_1_5', wajib: false, sort: i })])
ok((await call('get_content', [])).questions.length === 12, 'admin adds many feedback questions')
await expectErr('admin_upsert_question', [at, JSON.stringify({ id: 'bad id', teks: 'Valid text here', tipe: 'teks', wajib: true, sort: 1 })], 'invalid', 'bad question id rejected')
await expectErr('admin_upsert_question', [at, JSON.stringify({ id: 'qz', teks: 'hi', tipe: 'teks', wajib: true, sort: 1 })], 'invalid', 'too-short question rejected')
await call('admin_set_question_order', [at, ['qx12', 'q1']])
const ordered = (await call('get_content', [])).questions
ok(ordered.find((q) => q.id === 'qx12').sort === 1 && ordered.find((q) => q.id === 'q1').sort === 2, 'admin reorders questions')
await db.query(`insert into public.feedback_answers (participant_id, question_id, nilai_teks) values ($1, 'qx5', 'ok')`, [st.participant.id])
await call('admin_delete_question', [at, 'qx5'])
ok((await one(`select count(*)::int as n from public.feedback_answers where question_id = 'qx5'`)).n === 0, 'deleting a question deletes its answers')
await expectErr('admin_delete_question', [at, 'nope'], 'not_found', 'delete unknown question')

const edgeS = await call('edge_session', [at])
ok(edgeS.role === 'admin', 'edge_session resolves token (service role only)')

console.log(failures ? `\n${failures} FAILED` : '\nALL PASSED')
process.exit(failures ? 1 : 0)
