import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import { createClient } from 'npm:@supabase/supabase-js@2';

const WEBHOOK_URL = "https://hook.us1.make.com/bniwrl7y4nj3lcadtrotdsssmwe23gax";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { client_code, force } = await req.json();
    if (!client_code) {
      return new Response(JSON.stringify({ error: 'client_code required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: client, error: fetchErr } = await supabase
      .from('client_progress')
      .select('*')
      .eq('client_code', client_code)
      .maybeSingle();

    if (fetchErr) throw fetchErr;
    if (!client) {
      return new Response(JSON.stringify({ error: 'client not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Idempotent: only fire once
    if (client.completed_at && !force) {
      return new Response(JSON.stringify({ success: true, already_sent: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const now = new Date().toISOString();
    const rawName = client.company_name || client.brand_name || client.client_name || null;
    // Slack channel names: lowercase, no spaces/special chars, max 80 chars
    const company_name = rawName
      ? rawName
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
          .toLowerCase()
          .replace(/[^a-z0-9-_]/g, '')
          .slice(0, 80)
      : null;

    const payload = { company_name };

    const res = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const ok = res.ok;

    if (ok) {
      await supabase
        .from('client_progress')
        .update({ completed_at: now, current_step: 8, last_activity_at: now, updated_at: now })
        .eq('client_code', client_code);
    }

    await supabase.from('client_activity_log').insert({
      client_code,
      event_type: 'onboarding_complete_webhook',
      status: ok ? 'ok' : 'error',
      error: ok ? null : `HTTP ${res.status}`,
      details: { webhook: WEBHOOK_URL, company_name },
    });

    // Notify progress webhook (fire and forget)
    supabase.functions
      .invoke('notify-step-progress', { body: { client_code } })
      .catch((e) => console.error('notify-step-progress error:', e));

    return new Response(JSON.stringify({ success: ok, company_name }), {
      status: ok ? 200 : 502,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('notify-onboarding-complete error:', err);
    return new Response(JSON.stringify({ error: err?.message || 'unknown' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
