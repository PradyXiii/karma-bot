const fetch = require("node-fetch");
const DEBUG = process.env.DEBUG === "true";
function log(...a) { if (DEBUG) console.log("[redditBot]", ...a); }
function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }

async function getModhash(cookie) {
  const res = await fetch("https://old.reddit.com/api/me.json", {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Cookie": `reddit_session=${encodeURIComponent(cookie)}`,
      "Accept": "application/json"
    }
  });
  const text = await res.text();
  log("Modhash raw response:", text.slice(0,100));
  try {
    const data = JSON.parse(text);
    const modhash = data?.data?.modhash;
    log("Modhash fetch:", modhash ? "OK" : "FAILED — logged out?");
    return modhash || null;
  } catch(e) {
    log("Modhash JSON parse failed — cookie likely expired or invalid");
    return null;
  }
}

async function postComment(postFullname, commentText, cookie, modhash) {
  const res = await fetch("https://old.reddit.com/api/comment", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      "Cookie": `reddit_session=${encodeURIComponent(cookie)}`,
      "X-Requested-With": "XMLHttpRequest",
      "Referer": "https://old.reddit.com"
    },
    body: `thing_id=${encodeURIComponent(postFullname)}&text=${encodeURIComponent(commentText)}&uh=${encodeURIComponent(modhash)}&api_type=json`
  });
  const data = await res.json();
  log("Comment response:", JSON.stringify(data).slice(0,200));
  const success = !data.json?.errors?.length;
  return { success, error: data.json?.errors?.[0]?.[1] || "" };
}

async function fetchKarma(username) {
  try {
    const res = await fetch(`https://www.reddit.com/user/${encodeURIComponent(username)}/about.json`,
      { headers: { "User-Agent": "KarmaBot/1.0" }, timeout: 10000 });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      commentKarma: Number(data.data?.comment_karma || 0),
      postKarma:    Number(data.data?.link_karma || 0),
      total:        Number((data.data?.comment_karma || 0) + (data.data?.link_karma || 0))
    };
  } catch(e) { log("fetchKarma error:", e.message); return null; }
}

async function runBotSession(targets) {
  const username = process.env.REDDIT_USERNAME;
  const cookie   = process.env.REDDIT_SESSION_COOKIE;
  if (!username || !cookie) throw new Error("REDDIT_USERNAME or REDDIT_SESSION_COOKIE not set.");

  // Fetch fresh modhash from session (more reliable than storing it)
  const modhash = await getModhash(cookie);
  if (!modhash) throw new Error("Could not get modhash — session cookie may be expired.");
  log("Session valid. Modhash acquired.");

  const results = [];
  for (const target of targets) {
    const match = target.postUrl.match(/\/comments\/([a-z0-9]+)\//i);
    if (!match) { log("Could not extract post ID:", target.postUrl); continue; }
    const postFullname = "t3_" + match[1];

    const result = await postComment(postFullname, target.comment, cookie, modhash);
    results.push({ ...target, posted: result.success, error: result.error || null, postedAt: new Date().toISOString() });
    log(result.success ? `Posted: ${target.postTitle?.slice(0,60)}` : `Failed: ${result.error}`);

    if (targets.indexOf(target) < targets.length - 1) {
      const delay = 180000 + Math.floor(Math.random() * 240000);
      log(`Waiting ${Math.round(delay/60000)} min before next comment...`);
      await sleep(delay);
    }
  }
  return results;
}

module.exports = { runBotSession, fetchKarma };
