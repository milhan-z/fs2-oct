// Hands out a signed upload URL. Auth = app session token (not Supabase Auth), checked via public.edge_session.
//  kind "attendance": participant uploads own selfie → private bucket attendance-photos/<participantId>/<uuid>.jpg
//  kind "content":    admin uploads a stamp / speaker photo → public bucket content/<uuid>.<ext>
import { createClient } from 'npm:@supabase/supabase-js@2.50.0'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'method' }, 405)
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const { token, kind = 'attendance', ext = 'jpg' } = await req.json().catch(() => ({}))
  const { data: s } = await admin.rpc('edge_session', { p_token: token ?? '' })
  if (!s) return json({ error: 'auth', message: 'Sesi berakhir.' }, 401)

  if (kind === 'attendance') {
    if (s.role !== 'participant') return json({ error: 'forbidden' }, 403)
    const path = `${s.subject}/${crypto.randomUUID()}.jpg`
    const { data, error } = await admin.storage.from('attendance-photos').createSignedUploadUrl(path)
    if (error) return json({ error: 'storage', message: error.message }, 500)
    return json({ path, signedUrl: data.signedUrl, uploadToken: data.token })
  }
  if (kind === 'content') {
    if (s.role !== 'admin') return json({ error: 'forbidden' }, 403)
    const safeExt = ['jpg', 'png', 'webp'].includes(ext) ? ext : 'jpg'
    const path = `${crypto.randomUUID()}.${safeExt}`
    const { data, error } = await admin.storage.from('content').createSignedUploadUrl(path)
    if (error) return json({ error: 'storage', message: error.message }, 500)
    const publicUrl = admin.storage.from('content').getPublicUrl(path).data.publicUrl
    return json({ path, signedUrl: data.signedUrl, uploadToken: data.token, publicUrl })
  }
  return json({ error: 'kind' }, 400)
})
