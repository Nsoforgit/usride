const url = "https://paltenvcnqtqezvbpkxy.supabase.co/rest/v1/riders?select=id,name,email,wallet_balance,total_trips";
const key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBhbHRlbnZjbnF0cWV6dmJwa3h5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE4MTE4MDcsImV4cCI6MjA5NzM4NzgwN30._oCOoYFTB07HJoSPH40-I0lI-KEQjJor5bLizqLzeio";

async function test() {
  console.log("--- FETCHING RIDERS FROM SUPABASE API ---");
  try {
    const res = await fetch(url, {
      headers: {
        "apikey": key,
        "Authorization": `Bearer ${key}`
      }
    });
    const riders = await res.json();
    console.table(riders);

    if (riders && riders.length > 0) {
      const target = riders[0];
      const newBal = (Number(target.wallet_balance) || 0) + 1;
      console.log(`\nAttempting to UPDATE rider ${target.id} (${target.name}) wallet_balance to ${newBal}...`);
      
      const updateUrl = `https://paltenvcnqtqezvbpkxy.supabase.co/rest/v1/riders?id=eq.${target.id}`;
      const updateRes = await fetch(updateUrl, {
        method: "PATCH",
        headers: {
          "apikey": key,
          "Authorization": `Bearer ${key}`,
          "Content-Type": "application/json",
          "Prefer": "return=representation"
        },
        body: JSON.stringify({
          wallet_balance: newBal
        })
      });
      
      const responseText = await updateRes.text();
      console.log("Response Status:", updateRes.status);
      console.log("Response Text:", responseText);
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

test();
