'use strict';
/* Supabase (server/*.sql): the REST helper the boss timer groups, the game status history and bug reports use.
   The community builds that lived here were removed on 2026-11-25 (the user's call); earlier commits have them. */

const sbConfigured = () => { const c = window.RQC_CONFIG || {}; return !!(c.supabaseUrl && c.supabaseKey); };
async function sb(path, opts = {}) {
  const c = window.RQC_CONFIG;
  const res = await fetch(c.supabaseUrl.replace(/\/+$/, '') + '/rest/v1/' + path, {
    ...opts,
    // old-style anon keys are JWTs and also go into Authorization; new "sb_publishable_…" keys only in apikey
    headers: { apikey: c.supabaseKey, ...(c.supabaseKey.startsWith('eyJ') ? { Authorization: 'Bearer ' + c.supabaseKey } : {}), 'Content-Type': 'application/json', ...(opts.headers || {}) },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${res.status}: ${text.slice(0, 200)}`);
  return text ? JSON.parse(text) : null;
}

