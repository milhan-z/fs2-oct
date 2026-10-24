// Short-lived signed URLs for attendance photos.
// Participant: only own photo. Staff (thumbnails while confirming) and admin: any participant photo.
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
  const { token, paths } = await req.json().catch(() => ({}))
  const { data: s } = await admin.rpc('edge_session', { p_token: token ?? '' })
  if (!s) return json({ error: 'auth', message: 'Sesi berakhir.' }, 401)
  let list: string[] = Array.isArray(paths) ? paths.filter((p) => typeof p === 'string' && /^[0-9a-f-]{36}\/[0-9a-f-]{36}\.jpg$/.test(p)).slice(0, 200) : []
  if (s.role === 'participant') list = list.filter((p) => p.startsWith(`${s.subject}/`))
  if (!list.length) return json({ urls: {} })
  const { data, error } = await admin.storage.from('attendance-photos').createSignedUrls(list, 60 * 30)
  if (error) return json({ error: 'storage', message: error.message }, 500)
  const urls: Record<string, string> = {}
  for (const d of data) if (d.path && d.signedUrl) urls[d.path] = d.signedUrl
  return json({ urls })
})
