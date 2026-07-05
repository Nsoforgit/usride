// Supabase Edge Function: paystack-payout
// Deployed at: https://<project-ref>.supabase.co/functions/v1/paystack-payout

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

    console.log(`[Payout] Payout request: driverId: ${driverId}, bankCode: "${bankCode}", accountNumber: "${accountNumber}", amount: ${amount}`);

    if (!driverId || !bankCode || !accountNumber || !amount || amount <= 0) {
      return new Response(JSON.stringify({ error: 'Missing or invalid parameters' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      console.error('PAYSTACK_SECRET_KEY not set in Supabase Secrets');
      return new Response(JSON.stringify({ error: 'Server misconfiguration' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: driver, error: driverError } = await supabase
      .from('drivers')
      .select('id, wallet_balance, name')
      .eq('id', driverId)
      .maybeSingle();

    if (driverError || !driver) {
      return new Response(JSON.stringify({ error: 'Driver not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const currentBalance = Number(driver.wallet_balance) || 0;
    if (currentBalance < amount) {
      return new Response(JSON.stringify({ error: 'Insufficient wallet balance' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const newBalance = currentBalance - amount;

    // ── MOCK PATH FOR TEST BANK (001) ─────────────────────────────────────────
    if (bankCode === '001') {
      console.log('[Payout] Executing mock sandbox payout for Test Bank (001)');

      // 1. Deduct balance in DB
      const { error: updateError } = await supabase
        .from('drivers')
        .update({ wallet_balance: newBalance })
        .eq('id', driver.id);

      if (updateError) {
        console.error('[Payout] Failed to deduct driver wallet balance:', updateError);
        return new Response(JSON.stringify({ error: 'Database update failed' }), {
          status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 2. Log withdrawal transaction
      const mockTransferCode = `TRF-MOCK-${Date.now()}`;
      await supabase.from('wallet_transactions').insert({
        id: `tx-out-${mockTransferCode}`,
        user_id: driver.id,
        user_type: 'driver',
        type: 'withdrawal',
        amount: amount,
        reference: `MOCK-REF-${Date.now()}`,
        description: `Mock Sandbox Payout to Test Account (${accountNumber})`,
        created_at: new Date().toISOString(),
      });

      console.log(`[Payout] ✅ Successfully processed mock payout of ₦${amount} for ${driver.name}`);

      return new Response(
        JSON.stringify({
          success: true,
          recipient_name: 'Sandbox Test Account',
          amount,
          new_balance: newBalance,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ── REAL PATH FOR PRODUCTION BANKS ────────────────────────────────────────
    let verifiedAccountName = 'Bank Account';
    
    console.log(`[Payout] Resolving acct ${accountNumber} with bank ${bankCode}`);
    const resolveRes = await fetch(
      `https://api.paystack.co/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
      { headers: { Authorization: `Bearer ${paystackSecretKey}` } }
    );

    const resolveData = await resolveRes.json();
    if (!resolveRes.ok || !resolveData.status) {
      console.error('[Payout] Account resolution failed:', resolveData);
      return new Response(
        JSON.stringify({ error: resolveData.message || 'Could not verify bank account details' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    verifiedAccountName = resolveData.data.account_name;

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
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const recipientCode = recipientData.data.recipient_code;

    console.log(`[Payout] Initiating transfer of NGN ${amount} to ${recipientCode}`);
    const transferRes = await fetch('https://api.paystack.co/transfer', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        source: 'balance',
        amount: amount * 100,
        recipient: recipientCode,
        reason: `USRide Earnings Payout — Driver: ${driver.name}`,
      }),
    });

    const transferData = await transferRes.json();
    if (!transferRes.ok || !transferData.status) {
      console.error('[Payout] Transfer initiation failed:', transferData);
      return new Response(
        JSON.stringify({ error: transferData.message || 'Payout transfer initiation failed' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Deduct Driver Wallet Balance
    const { error: updateError } = await supabase
      .from('drivers')
      .update({ wallet_balance: newBalance })
      .eq('id', driver.id);

    if (updateError) {
      console.error('[Payout] Failed to deduct driver wallet balance:', updateError);
      return new Response(
        JSON.stringify({
          error: 'Payout initiated, but database balance update failed. Please contact admin.',
          transfer_code: transferData.data.transfer_code,
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log Payout Withdrawal Transaction
    const transferCode = transferData.data.transfer_code;
    await supabase.from('wallet_transactions').insert({
      id: `tx-out-${transferCode}`,
      user_id: driver.id, user_type: 'driver', type: 'withdrawal',
      amount: amount, reference: transferData.data.reference || `PAY-${Date.now()}`,
      description: `Payout to ${verifiedAccountName} (${accountNumber}) via Paystack`,
      created_at: new Date().toISOString(),
    });

    console.log(`[Payout] ✅ Successfully processed payout of ₦${amount} to ${driver.name}`);

    return new Response(
      JSON.stringify({ success: true, recipient_name: verifiedAccountName, amount, new_balance: newBalance }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    console.error('[Payout] Unhandled server error:', err);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
