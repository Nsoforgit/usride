// Supabase Edge Function: paystack-payout
// Deployed at: https://<project-ref>.supabase.co/functions/v1/paystack-payout
//
// This function:
//   1. Receives driver withdrawal details (driverId, bankCode, accountNumber, amount)
//   2. Checks if the driver has sufficient balance in the DB
//   3. Resolves the account name with Paystack for validation
//   4. Creates a transfer recipient on Paystack
//   5. Initiates the transfer from the Paystack merchant balance
//   6. Deducts the amount from the driver's database row and logs a withdrawal transaction

import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { driverId, bankCode, accountNumber, amount } = await req.json();

    if (!driverId || !bankCode || !accountNumber || !amount || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Missing or invalid parameters' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      console.error('PAYSTACK_SECRET_KEY not set in Supabase Secrets');
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 1. Connect to Supabase with SERVICE ROLE key ─────────────────────────
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // ── 2. Retrieve Driver and Verify Balance ───────────────────────────────
    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('id, wallet_balance, name')
      .eq('id', driverId)
      .maybeSingle();

    if (driverError || !driver) {
      console.error('Driver not found:', driverError);
      return new Response(JSON.stringify({ error: 'Driver not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const currentBalance = Number(driver.wallet_balance) || 0;
    if (currentBalance < amount) {
      return new Response(JSON.stringify({ error: 'Insufficient wallet balance' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // ── 3. Paystack Step 1: Resolve Account Name ──────────────────────────────
    console.log(`[Payout] Resolving acct ${accountNumber} with bank ${bankCode}`);
    const resolveRes = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      {
        headers: {
          Authorization: `Bearer ${paystackSecretKey}`,
        },
      }
    );

    const resolveData = await resolveRes.json();
    if (!resolveRes.ok || !resolveData.status) {
      console.error('[Payout] Account resolution failed:', resolveData);
      return new Response(
        JSON.stringify({ error: resolveData.message || 'Could not verify bank account details' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const verifiedAccountName = resolveData.data.account_name;
    console.log('[Payout] Account resolved successfully:', verifiedAccountName);

    // ── 4. Paystack Step 2: Create Transfer Recipient ─────────────────────────
    console.log('[Payout] Creating transfer recipient on Paystack');
    const recipientRes = await fetch('https://api.paystack.co/transferrecipient', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
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
      return new Response(JSON.stringify({ error: 'Failed to register recipient bank account' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recipientCode = recipientData.data.recipient_code;

    // ── 5. Paystack Step 3: Initiate Transfer ────────────────────────────────
    console.log(`[Payout] Initiating transfer of NGN ${amount} to ${recipientCode}`);
    const transferRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: amount * 100, // Paystack requires kobo (smallest currency unit)
        recipient: recipientCode,
        reason: `USRide Earnings Payout — Driver: ${driver.name}`,
      }),
    });

    const transferData = await transferRes.json();
    if (!transferRes.ok || !transferData.status) {
      console.error('[Payout] Transfer initiation failed:', transferData);
      return new Response(
        JSON.stringify({ error: transferData.message || 'Payout transfer initiation failed' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // ── 6. Deduct Driver Wallet Balance in Database ──────────────────────────
    const newBalance = currentBalance - amount;
    const { error: updateError } = await supabase
      .from('drivers')
      .update({ wallet_balance: newBalance })
      .eq('id', driver.id);

    if (updateError) {
      console.error('[Payout] Failed to deduct driver wallet balance:', updateError);
      // Payout already left Paystack but DB failed to deduct — trigger high-priority warning
      return new Response(
        JSON.stringify({
          error: 'Payout initiated, but database balance update failed. Please contact admin.',
          transfer_code: transferData.data.transfer_code,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // ── 7. Log Payout Withdrawal Transaction ────────────────────────────────
    const transferCode = transferData.data.transfer_code;
    const { error: txError } = await supabase.from('wallet_transactions').insert({
      id: `tx-out-${transferCode}`,
      user_id: driver.id,
      user_type: 'driver',
      type: 'withdrawal',
      amount: amount,
      reference: transferData.data.reference || `PAY-${Date.now()}`,
      description: `Payout to ${verifiedAccountName} (${accountNumber}) via Paystack`,
      created_at: new Date().toISOString(),
    });

    if (txError) {
      console.error('[Payout] Transaction logging failed (non-fatal):', txError);
    }

    console.log(`[Payout] ✅ Successfully processed payout of ₦${amount} to ${driver.name}`);

    return new Response(
      JSON.stringify({
        success: true,
        recipient_name: verifiedAccountName,
        amount,
        new_balance: newBalance,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (err) {
    console.error('[Payout] Unhandled server error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
