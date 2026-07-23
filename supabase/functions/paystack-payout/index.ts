// Supabase Edge Function: paystack-payout
// Production-only — all sandbox/mock paths removed.
// Flow:
//   1. Validate request parameters & secret key
//   2. Verify driver exists and has sufficient balance
//   3. Resolve the bank account name via Paystack
//   4. Create a Paystack Transfer Recipient
//   5. Initiate the Paystack Transfer
//   6. ONLY after transfer confirmed: deduct wallet balance in DB
//   7. Log the withdrawal transaction

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { driverId, bankCode, accountNumber, amount } = await req.json();

    console.log(`[Payout] Request: driverId=${driverId}, bank=${bankCode}, acct=${accountNumber}, amount=NGN${amount}`);

    // -- 1. Validate Parameters --
    if (!driverId || !bankCode || !accountNumber || !amount || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Missing or invalid parameters' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      console.error('[Payout] PAYSTACK_SECRET_KEY not set in Supabase Secrets');
      return new Response(JSON.stringify({ error: 'Server misconfiguration: payment key not set' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Guard against accidentally using a test key in production
    if (paystackSecretKey.startsWith('sk_test_')) {
      console.error('[Payout] Test secret key in use — update PAYSTACK_SECRET_KEY to sk_live_ in Supabase Secrets');
      return new Response(JSON.stringify({ error: 'Payment system is in test mode. Contact admin.' }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // -- 2. Verify Driver & Balance --
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('id, wallet_balance, name')
      .eq('id', driverId)
      .maybeSingle();

    if (driverError || !driver) {
      console.error('[Payout] Driver not found:', driverError);
      return new Response(JSON.stringify({ error: 'Driver not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const currentBalance = Number(driver.wallet_balance) || 0;
    if (currentBalance < amount) {
      return new Response(JSON.stringify({
        error: `Insufficient balance. Available: NGN${currentBalance.toLocaleString()}, Requested: NGN${amount.toLocaleString()}`
      }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const newBalance = currentBalance - amount;

    // -- 3. Resolve Bank Account via Paystack --
    console.log(`[Payout] Resolving account ${accountNumber} with bank ${bankCode}`);
    const resolveRes = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      { headers: { Authorization: `Bearer ${paystackSecretKey}` } }
    );
    const resolveData = await resolveRes.json();

    if (!resolveRes.ok || !resolveData.status) {
      console.error('[Payout] Account resolution failed:', resolveData);
      return new Response(
        JSON.stringify({ error: resolveData.message || 'Could not verify bank account. Check the account number and bank.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const verifiedAccountName = resolveData.data.account_name;
    console.log(`[Payout] Account resolved: ${verifiedAccountName}`);

    // -- 4. Create Transfer Recipient --
    const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: { Authorization: `Bearer ${paystackSecretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'nuban',
        name: verifiedAccountName,
        account_number: accountNumber,
        bank_code: bankCode,
        currency: 'NGN',
      }),
    });
    const recipientData = await recipientRes.json();

    if (!recipientRes.ok || !recipientData.status) {
      console.error('[Payout] Create recipient failed:', recipientData);
      return new Response(JSON.stringify({ error: 'Failed to register recipient bank account with Paystack' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const recipientCode = recipientData.data.recipient_code;
    console.log(`[Payout] Recipient created: ${recipientCode}`);

    // -- 5. Initiate Transfer (Naira -> Kobo conversion: × 100) --
    const transferRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: { Authorization: `Bearer ${paystackSecretKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'balance',
        amount: amount * 100,
        recipient: recipientCode,
        reason: `USRide Earnings Payout — ${driver.name}`,
      }),
    });
    const transferData = await transferRes.json();

    if (!transferRes.ok || !transferData.status) {
      console.error('[Payout] Transfer failed:', transferData);
      return new Response(
        JSON.stringify({ error: transferData.message || 'Payout failed. Ensure your Paystack balance is funded.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const transferCode = transferData.data.transfer_code;
    const transferStatus = transferData.data.status;
    console.log(`[Payout] Transfer initiated: ${transferCode}, status: ${transferStatus}`);

    if (transferStatus === 'failed') {
      return new Response(
        JSON.stringify({ error: 'Paystack rejected the transfer. Check account details or fund your Paystack balance.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // -- 6. Deduct Balance ONLY after successful transfer initiation --
    const { error: updateError } = await supabase
      .from('drivers')
      .update({ wallet_balance: newBalance })
      .eq('id', driver.id);

    if (updateError) {
      console.error(`[Payout] CRITICAL: Transfer ${transferCode} sent but DB update FAILED for ${driverId}:`, updateError);
      return new Response(JSON.stringify({
        error: 'Transfer sent but wallet update failed. Contact admin with your transfer code.',
        transfer_code: transferCode,
        requires_manual_reconciliation: true,
      }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // -- 7. Log Withdrawal Transaction --
    await supabase.from('wallet_transactions').insert({
      id: `tx-out-${transferCode}`,
      user_id: driver.id,
      user_type: 'driver',
      type: 'withdrawal',
      amount: amount,
      reference: transferData.data.reference || `PAY-${Date.now()}`,
      description: `Payout to ${verifiedAccountName} (${accountNumber}) — Ref: ${transferCode}`,
      created_at: new Date().toISOString(),
    });

    console.log(`[Payout] SUCCESS: NGN${amount} → ${driver.name} (${verifiedAccountName}). Code: ${transferCode}`);

    return new Response(JSON.stringify({
      success: true,
      recipient_name: verifiedAccountName,
      amount,
      new_balance: newBalance,
      transfer_code: transferCode,
      transfer_status: transferStatus,
    }), { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

  } catch (err) {
    console.error('[Payout] Unhandled error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error. Please try again.' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
