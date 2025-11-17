// Use the http server entrypoint which exports `serve` for this std version
import { serve } from 'https://deno.land/std@0.201.0/http/server.ts'
// Use a CDN-built ESM bundle for supabase-js which is compatible with Deno bundling
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const svc = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } })

async function verifyAdmin(req: Request) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return { ok: false, status: 401, body: { error: 'Missing token' } }

  const { data: userData, error: userErr } = await svc.auth.getUser(token as string)
  if (userErr || !userData?.user) return { ok: false, status: 401, body: { error: 'Invalid token' } }
  const callerUid = userData.user.id

  const { data: callerRow, error: rowErr } = await svc.from('users').select('authorisation').eq('uid', callerUid).maybeSingle()
  if (rowErr) return { ok: false, status: 500, body: { error: rowErr.message } }
  if (!callerRow?.authorisation) return { ok: false, status: 403, body: { error: 'Forbidden' } }

  return { ok: true, callerUid }
}

serve(async (req: Request) => {
  const url = new URL(req.url)
  const path = url.pathname

  // CORS headers - allow from any origin for admin functions (adjust for production)
  const CORS_HEADERS: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization, Content-Type',
  };

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const sendJSON = (body: any, status = 200) => {
    const json = JSON.stringify(body ?? {});
    return new Response(json, { status, headers: { 'Content-Type': 'application/json', ...CORS_HEADERS } });
  };

  // Basic routing: /admin-users/create, /admin-users/flags/:uid, /admin-users/disable/:uid
  try {
    if (req.method === 'POST' && path.endsWith('/create')) {
      const v = await verifyAdmin(req)
      if (!v.ok) return sendJSON(v.body, v.status)

      const body = await req.json()
      const email = body.email
      const name = body.name ?? null
      const password = body.password ?? 'MISC1234'

      const { data: createdAuth, error: signErr } = await svc.auth.admin.createUser({ email, password, email_confirm: true })
  if (signErr) return sendJSON({ error: signErr.message }, 400)
      const uid = createdAuth.user.id

  const { data: ins, error: insErr } = await svc.from('users').upsert({ uid, email, name, settings: false, authorisation: false, analytics: false }, { onConflict: 'uid' }).select()
      if (insErr) return sendJSON({ error: insErr.message }, 500)

      return sendJSON({ ok: true, user: ins }, 200)
    }

    if (req.method === 'PATCH' && path.includes('/flags/')) {
      const v = await verifyAdmin(req)
      if (!v.ok) return sendJSON(v.body, v.status)
      const uid = path.split('/').pop()!
      const body = await req.json()
      const { data, error } = await svc.from('users').update(body).eq('uid', uid).select()
      if (error) return sendJSON({ error: error.message }, 500)
      return sendJSON({ ok: true, data }, 200)
    }
    // Delete user (remove from auth and users table)
    if ((req.method === 'DELETE' || (req.method === 'POST' && path.includes('/delete/'))) && path.includes('/delete/')) {
      const v = await verifyAdmin(req)
      if (!v.ok) return sendJSON(v.body, v.status)
      const uid = path.split('/').pop()!
      // Delete from auth
      try {
        const { error: delAuthErr } = await svc.auth.admin.deleteUser(uid)
        if (delAuthErr) return sendJSON({ error: delAuthErr.message }, 500)
      } catch (e: any) {
        return sendJSON({ error: String(e) }, 500)
      }
      // Delete from users table
      const { data, error } = await svc.from('users').delete().eq('uid', uid).select()
      if (error) return sendJSON({ error: error.message }, 500)
      return sendJSON({ ok: true, data }, 200)
    }
    return sendJSON({ error: 'Not found' }, 404)
  } catch (err: any) {
    return sendJSON({ error: err?.message ?? String(err) }, 500)
  }
})
