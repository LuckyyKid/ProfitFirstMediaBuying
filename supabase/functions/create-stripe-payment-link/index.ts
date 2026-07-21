import { corsHeaders } from 'npm:@supabase/supabase-js@2/cors';
import Stripe from 'npm:stripe@17';
import { createClient } from 'npm:@supabase/supabase-js@2';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const {
      deal_value,
      client_name,
      client_code,
      client_id,
      deal_id,
      payment_type = 'one_time', // 'one_time' | 'recurring'
      interval = 'month',
      currency = 'cad',
      description,
    } = await req.json();

    const amount = Number(deal_value);
    if (!amount || amount <= 0) {
      return new Response(
        JSON.stringify({ error: 'deal_value invalide' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: 'STRIPE_SECRET_KEY non configurée' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-11-20.acacia' });
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const isRecurring = payment_type === 'recurring';

    // 1. Product
    const product = await stripe.products.create({
      name: description || `TDIA – ${client_name || client_code || 'Client'}`,
      metadata: {
        client_code: client_code || '',
        client_id: client_id || '',
        deal_id: deal_id || '',
        payment_type,
      },
    });

    // 2. Price (recurring vs one-time)
    const price = await stripe.prices.create({
      product: product.id,
      unit_amount: Math.round(amount * 100),
      currency: currency.toLowerCase(),
      ...(isRecurring ? { recurring: { interval } } : {}),
    });

    // 3. Payment link
    const paymentLink = await stripe.paymentLinks.create({
      line_items: [{ price: price.id, quantity: 1 }],
      metadata: {
        client_code: client_code || '',
        client_id: client_id || '',
        deal_id: deal_id || '',
        payment_type,
      },
    });

    // Update client_progress
    let cpQuery = supabase
      .from('client_progress')
      .update({
        stripe_link: paymentLink.url,
        stripe_amount_expected: amount,
        last_activity_at: new Date().toISOString(),
      });
    if (client_code && client_id) {
      cpQuery = cpQuery.or(`client_code.eq.${client_code},client_id.eq.${client_id}`);
    } else if (client_code) {
      cpQuery = cpQuery.eq('client_code', client_code);
    } else if (client_id) {
      cpQuery = cpQuery.eq('client_id', client_id);
    }
    await cpQuery;

    // Update closed_deals
    if (deal_id) {
      await supabase
        .from('closed_deals')
        .update({
          stripe_payment_url: paymentLink.url,
          stripe_payment_link_id: paymentLink.id,
          stripe_payment_type: payment_type,
        })
        .eq('id', deal_id);
    } else if (client_code) {
      await supabase
        .from('closed_deals')
        .update({
          stripe_payment_url: paymentLink.url,
          stripe_payment_link_id: paymentLink.id,
          stripe_payment_type: payment_type,
        })
        .eq('client_code', client_code);
    }

    return new Response(
      JSON.stringify({ url: paymentLink.url, id: paymentLink.id, payment_type }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    console.error('Stripe error:', err);
    return new Response(
      JSON.stringify({ error: err?.message || 'Erreur inconnue' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
