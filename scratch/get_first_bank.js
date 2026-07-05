const url = "https://api.paystack.co/bank?currency=NGN";

async function getFirstBank() {
  try {
    const res = await fetch(url);
    const data = await res.json();
    const match = data.data.find(b => b.name.toLowerCase().includes("first bank"));
    console.log("--- FIRST BANK OF NIGERIA DETAIL ---");
    console.log(match);
  } catch (err) {
    console.error(err);
  }
}

getFirstBank();
