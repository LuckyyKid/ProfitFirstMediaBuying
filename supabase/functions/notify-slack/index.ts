import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, companyNumber, completionMessage } = await req.json();

    if (!name) {
      return new Response(
        JSON.stringify({ error: 'Name is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const webhookUrl = Deno.env.get('SLACK_WEBHOOK_URL');
    if (!webhookUrl) {
      throw new Error('SLACK_WEBHOOK_URL not configured');
    }

    let slackText: string;
    if (completionMessage) {
      slackText = `✅ Session terminée!\n\n👤 *${name}* a complété toutes les étapes de l'onboarding.\n🏢 *Numéro de compagnie:* ${companyNumber || 'N/A'}\n📅 *Date:* ${new Date().toLocaleString('fr-FR', { timeZone: 'America/Montreal' })}`;
    } else {
      slackText = `🆕 Nouveau visiteur onboarding!\n\n👤 *Nom:* ${name}\n🏢 *Numéro de compagnie:* ${companyNumber}\n📅 *Date:* ${new Date().toLocaleString('fr-FR', { timeZone: 'America/Montreal' })}`;
    }

    const slackMessage = { text: slackText };

    const slackResponse = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(slackMessage),
    });

    if (!slackResponse.ok) {
      throw new Error(`Slack API error: ${slackResponse.status}`);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
