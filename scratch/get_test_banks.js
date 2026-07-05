const url = "https://api.paystack.co/bank?currency=NGN";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhbHRlbnZjbnF0cWV6dmJwa3h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MTE4MDcsImV4cCI6MjA5NzM4NzgwN30._oCOoYFTB07HJoSPH40-I0lI-KEQjJor5bLizqLzeio"; // Using the anon key is fine but wait, let's call Paystack API directly with the secret key if we have it? No, wait, the GET /bank endpoint does not require authentication, or it can use any key. Let's call it with no authorization first, or with the secret key we have? Wait, Deno env had the secret key. But we can just call it without auth, or we can use our node test script. Let's check if we need auth. Yes, Paystack GET /bank does not require auth, or if it does we can pass the public key. Let's try to fetch it.

async function getBanks() {
  try {
    const res = await fetch(url);
    const data = await res.json();
    const testBanks = data.data.filter(b => b.name.toLowerCase().includes("test") || b.slug.toLowerCase().includes("test") || b.code.startsWith("569") || b.code === "000" || b.code === "001");
    console.log("--- TEST BANKS FOUND ---");
    console.log(testBanks);
    
    console.log("\n--- FIRST 20 BANKS IN LIST ---");
    console.log(data.data.slice(0, 20).map(b => ({ name: b.name, code: b.code, slug: b.slug })));
  } catch (err) {
    console.error(err);
  }
}

getBanks();
