const url = "https://api.paystack.co/transferrecipient";
const key = "sk_test_26e1483b6bd02ecaff90d237ab3d0ad5f331d9f0"; // The test secret key they set or we had? Wait, they had the secret key sk_test_... but did they share it here? They only shared the public key pk_test_26e1483b6bd02ecaff90d237ab3d0ad5f331d9f0. Ah! We don't have the secret key locally. But wait! Can we check if the VITE_SUPABASE_ANON_KEY is in the env? Yes, but that is the Supabase key. We do not have their Paystack secret key in our local env because it was added directly to Supabase Secrets.

// Wait! Since we don't have the secret key, let's look closely at the error response:
// "[Payout] Create recipient failed: { status: false, message: "Cannot resolve account", ... code: "invalid_bank_code" }"
//
// Let's do a web search on: Paystack "Create recipient failed" "invalid_bank_code"
