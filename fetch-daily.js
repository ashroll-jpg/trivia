// Builds one shared set per day (3 easy, 2 medium, 1 hard = 6) and appends it
// to archive.json, which the app reads for both today's set and past days.
// Run by .github/workflows/daily.yml (Node 18+; has global fetch).

const fs = require("fs");

const TIMEZONE = "America/New_York";       // the day rolls over on this clock
const MIX = [["easy", 3], ["medium", 2], ["hard", 1]];
const sleep = (ms) => new Promise((s) => setTimeout(s, ms));

async function fetchDiff(difficulty, amount) {
  const url = `https://opentdb.com/api.php?type=multiple&encode=url3986&difficulty=${difficulty}&amount=${amount}`;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const r = await fetch(url);
      const j = await r.json();
      if (j.response_code === 0 && Array.isArray(j.results) && j.results.length >= amount) {
        return j.results.slice(0, amount);
      }
      if (j.response_code === 5) { await sleep(5500); continue; } // rate limited
      await sleep(3000);
    } catch (e) {
      await sleep(3000);
    }
  }
  return null;
}

(async () => {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(new Date()); // YYYY-MM-DD

  // Load the existing archive (or start a new one)
  let archive = { days: {} };
  try {
    const prev = JSON.parse(fs.readFileSync("archive.json", "utf8"));
    if (prev && prev.days) archive = prev;
  } catch (_) {}

  if (archive.days[date]) {
    console.log("Archive already has", date, "- nothing to do.");
    process.exit(0);
  }

  // Fetch each difficulty (spaced out to stay under opentdb's rate limit)
  let results = [];
  for (const [difficulty, amount] of MIX) {
    const batch = await fetchDiff(difficulty, amount);
    if (!batch) {
      console.error("Failed fetching", difficulty, "- leaving archive.json unchanged.");
      process.exit(0); // don't write a partial day
    }
    results = results.concat(batch);
    await sleep(5500);
  }

  archive.days[date] = { date, results };
  fs.writeFileSync("archive.json", JSON.stringify(archive));
  console.log("Added", date, "to archive with", results.length, "questions.");
})();
