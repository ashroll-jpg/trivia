// Fetches one shared set of questions per day and writes daily.json.
// Run automatically by .github/workflows/daily.yml (Node 18+; has global fetch).
// Keep DAILY_COUNT in sync with index.html.

const fs = require("fs");

const DAILY_COUNT = 5;
const TIMEZONE = "America/New_York"; // the day rolls over on this clock; change to your team's zone
const API = "https://opentdb.com/api.php?type=multiple&encode=url3986&amount=" + DAILY_COUNT;

(async () => {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date()); // YYYY-MM-DD

  let results = [];
  for (let attempt = 0; attempt < 6 && results.length < DAILY_COUNT; attempt++) {
    try {
      const r = await fetch(API);
      const j = await r.json();
      if (j.response_code === 0 && Array.isArray(j.results)) { results = j.results; break; }
      if (j.response_code === 5) { await new Promise(s => setTimeout(s, 5500)); continue; } // rate limited
      await new Promise(s => setTimeout(s, 2500));
    } catch (e) {
      await new Promise(s => setTimeout(s, 3000));
    }
  }

  if (results.length < DAILY_COUNT) {
    console.error("Could not fetch enough questions; leaving the existing daily.json in place.");
    process.exit(0); // don't overwrite a good file with a bad one
  }

  fs.writeFileSync("daily.json", JSON.stringify({ date, results }));
  console.log("Wrote daily.json for", date, "with", results.length, "questions.");
})();
