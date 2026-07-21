import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { client_code, client_id } = await req.json();
    if (!client_code && !client_id) {
      return new Response(JSON.stringify({ error: 'client_code ou client_id requis' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }


    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return new Response(JSON.stringify({ error: 'STRIPE_SECRET_KEY non configurée' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-11-20.acacia' });

    const matchesIdentifiers = (metadata?: Record<string, string | undefined | null>) => {
      const metaClientId = metadata?.client_id?.trim();
      const metaClientCode = metadata?.client_code?.trim();

      return Boolean(
        (client_id && metaClientId === client_id) ||
        (client_code && metaClientCode === client_code) ||
        (client_code && metaClientId === client_code)
      );
    };

    let paid = false;
    let amount = 0;
    let sessionId: string | null = null;
    let customerId: string | null = null;
    let paidAt: string | null = null;
    let paymentLinkId: string | null = null;

    const events = await stripe.events.list({
      types: [
        'checkout.session.completed',
        'checkout.session.async_payment_succeeded',
        'payment_intent.succeeded',
      ],
      limit: 100,
    });

    for (const event of events.data) {
      const object = event.data.object;

      if (object.object === 'checkout.session') {
        if (!matchesIdentifiers(object.metadata)) continue;
        if (object.payment_status !== 'paid') continue;

        paid = true;
        amount = (object.amount_total || 0) / 100;
        sessionId = object.id;
        customerId = typeof object.customer === 'string' ? object.customer : object.customer?.id ?? null;
        paidAt = new Date((object.created || Math.floor(Date.now() / 1000)) * 1000).toISOString();
        paymentLinkId = typeof object.payment_link === 'string'
          ? object.payment_link
          : object.payment_link?.id ?? null;
        break;
      }

      if (object.object === 'payment_intent') {
        if (!matchesIdentifiers(object.metadata)) continue;
        if (object.status !== 'succeeded') continue;

        paid = true;
        amount = (object.amount_received || object.amount || 0) / 100;
        customerId = typeof object.customer === 'string' ? object.customer : object.customer?.id ?? null;
        paidAt = new Date(object.created * 1000).toISOString();
        break;
      }
    }

    if (paid) {
      if (paymentLinkId) {
        try {
          await stripe.paymentLinks.update(paymentLinkId, { active: false });
        } catch (linkError) {
          console.error('check-stripe-payment link disable error:', linkError);
        }
      }

      // Update local client_progress
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      );
      let updateQuery = supabase
        .from('client_progress')
        .update({
          paid: true,
          stripe_amount_paid: amount,
          stripe_customer_id: customerId,
          payment_completed_at: paidAt || new Date().toISOString(),
          stripe_link: null,
          last_activity_at: new Date().toISOString(),
        });

      if (client_code && client_id) {
        updateQuery = updateQuery.or(`client_code.eq.${client_code},client_id.eq.${client_id}`);
      } else if (client_code) {
        updateQuery = updateQuery.eq('client_code', client_code);
      } else {
        updateQuery = updateQuery.eq('client_id', client_id);
      }

      await updateQuery;

      // Notify progress webhook (fire and forget)
      const codeForNotify = client_code || (async () => {
        const { data: row } = await supabase
          .from('client_progress')
          .select('client_code')
          .eq('client_id', client_id)
          .maybeSingle();
        return row?.client_code;
      });
      const code = typeof codeForNotify === 'string' ? codeForNotify : await codeForNotify();
      if (code) {
        supabase.functions
          .invoke('notify-step-progress', { body: { client_code: code } })
          .catch((e) => console.error('notify-step-progress error:', e));
      }
    }

    return new Response(
      JSON.stringify({ paid, amount, session_id: sessionId, customer_id: customerId, payment_link_disabled: Boolean(paymentLinkId && paid) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err: any) {
    console.error('check-stripe-payment error:', err);
    return new Response(JSON.stringify({ error: err?.message || 'Erreur inconnue' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
