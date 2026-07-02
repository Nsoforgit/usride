// Supabase Edge Function: paystack-webhook
// Deployed at: https://<project-ref>.supabase.co/functions/v1/paystack-webhook
//
// This function:
//   1. Receives the POST webhook from Paystack after a successful payment
//   2. Verifies the HMAC-SHA512 signature using PAYSTACK_SECRET_KEY
//   3. Credits the rider's wallet_balance in the database
//   4. Is idempotent - duplicate webhooks are safely ignored via unique reference check

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // ── 1. Read raw body (must be raw for HMAC verification) ─────────────────
    const rawBody = await req.text();

    // ── 2. Verify Paystack HMAC-SHA512 signature ──────────────────────────────
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      console.error('PAYSTACK_SECRET_KEY not set');
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const signature = req.headers.get('x-paystack-signature');
    if (!signature) {
      return new Response(JSON.stringify({ error: 'Missing signature' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Compute expected HMAC-SHA512
    const encoder = new TextEncoder();
    const keyData = encoder.encode(paystackSecretKey);
    const messageData = encoder.encode(rawBody);
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    if (signature !== expectedSignature) {
      console.error('Signature mismatch — request not from Paystack');
      return new Response(JSON.stringify({ error: 'Invalid signature' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 3. Parse the event ────────────────────────────────────────────────────
    const event = JSON.parse(rawBody);
    console.log('[Paystack Webhook] Event received:', event.event);

    // We only care about successful charge events
    if (event.event !== 'charge.success') {
      return new Response(JSON.stringify({ received: true, action: 'ignored' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { reference, amount, metadata, customer } = event.data;
    // amount from Paystack is in kobo (smallest unit) — divide by 100 for Naira
    const amountNaira = amount / 100;
    // rider_id is passed as metadata when we initialize the Paystack popup
    const riderId = metadata?.rider_id;
    const riderEmail = customer?.email;

    if (!riderId && !riderEmail) {
      console.error('No rider identifier in webhook payload');
      return new Response(JSON.stringify({ error: 'Missing rider identifier' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 4. Connect to Supabase with SERVICE ROLE key (bypasses RLS) ──────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── 5. Idempotency check — ignore duplicate webhooks ─────────────────────
    const { data: existing } = await supabase
      .from('wallet_transactions')
      .select('id')
      .eq('reference', reference)
      .maybeSingle();

    if (existing) {
      console.log('[Paystack Webhook] Duplicate reference, ignoring:', reference);
      return new Response(JSON.stringify({ received: true, action: 'duplicate_ignored' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 6. Find the rider ─────────────────────────────────────────────────────
    let riderQuery = supabase.from('riders').select('id, wallet_balance');
    if (riderId) {
      riderQuery = riderQuery.eq('id', riderId);
    } else {
      riderQuery = riderQuery.eq('email', riderEmail);
    }
    const { data: rider, error: riderError } = await riderQuery.maybeSingle();

    if (riderError || !rider) {
      console.error('Rider not found:', riderError);
      return new Response(JSON.stringify({ error: 'Rider not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 7. Credit the rider's wallet ──────────────────────────────────────────
    const newBalance = (rider.wallet_balance || 0) + amountNaira;
    const { error: updateError } = await supabase
      .from('riders')
      .update({ wallet_balance: newBalance })
      .eq('id', rider.id);

    if (updateError) {
      console.error('Failed to update wallet balance:', updateError);
      return new Response(JSON.stringify({ error: 'Balance update failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 8. Log the transaction ────────────────────────────────────────────────
    const { error: txError } = await supabase.from('wallet_transactions').insert({
      id: `tx-topup-${reference}`,
      user_id: rider.id,
      user_type: 'rider',
      type: 'credit',
      amount: amountNaira,
      reference,
      description: `Wallet Top-Up via Paystack (₦${amountNaira.toLocaleString()})`,
      created_at: new Date().toISOString(),
    });

    if (txError) {
      // Non-fatal — balance was already credited; log and continue
      console.error('Transaction log failed (non-fatal):', txError);
    }

    console.log(`[Paystack Webhook] ✅ Credited ₦${amountNaira} to rider ${rider.id}`);

    return new Response(
      JSON.stringify({ received: true, credited: amountNaira, rider_id: rider.id }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('[Paystack Webhook] Unhandled error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
