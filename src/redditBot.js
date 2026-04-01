const fetch = require("node-fetch");
const DEBUG = process.env.DEBUG === "true";
function log(...a) { if (DEBUG) console.log("[redditBot]", ...a); }
function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }

async function getRedditToken(username, password) {
  const res = await fetch("https://www.reddit.com/api/v1/access_token", {
    method: "POST",
    headers: {
      "Authorization": "Basic " + Buffer.from("NO_CLIENT_ID:NO_CLIENT_SECRET").toString("base64"),
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": `KarmaBot/1.0 by ${username}`
    },
    body: `grant_type=password&username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`
  });
  const data = await res.json();
  log("Token response:", JSON.stringify(data).slice(0,150));
  return data.access_token || null;
}

async function postComment(token, postFullname, commentText, username) {
  const res = await fetch("https://oauth.reddit.com/api/comment", {
    method: "POST",
    headers: {
      "Authorization": `bearer ${token}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": `KarmaBot/1.0 by ${username}`
    },
    body: `thing_id=${encodeURIComponent(postFullname)}&text=${encodeURIComponent(commentText)}`
  });
  const data = await res.json();
  log("Comment response:", JSON.stringify(data).slice(0,200));
  const success = !data.json?.errors?.length;
  return { success, error: data.json?.errors?.[0]?.[1] || "" };
}

async function fetchKarma(username) {
  try {
    const res = await fetch(`https://www.reddit.com/user/${encodeURIComponent(username)}/about.json`,
      { headers: { "User-Agent": `KarmaBot/1.0 by ${username}` }, timeout: 10000 });
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
  const password = process.env.REDDIT_PASSWORD;
  if (!username || !password) throw new Error("REDDIT_USERNAME or REDDIT_PASSWORD not set.");

  const token = await getRedditToken(username, password);
  if (!token) throw new Error("Reddit token fetch failed. Check credentials.");
  log("Token acquired.");

  const results = [];
  for (const target of targets) {
    // Extract post ID and build t3_ fullname
    const match = target.postUrl.match(/\/comments\/([a-z0-9]+)\//i);
    if (!match) { log("Could not extract post ID from:", target.postUrl); continue; }
    const postFullname = "t3_" + match[1];

    const result = await postComment(token, postFullname, target.comment, username);
    results.push({ ...target, posted: result.success, error: result.error || null, postedAt: new Date().toISOString() });
    log(result.success ? `Posted: ${target.postTitle?.slice(0,60)}` : `Failed: ${result.error}`);

    if (targets.indexOf(target) < targets.length - 1) {
      const delay = 180000 + Math.floor(Math.random() * 240000);
      log(`Waiting ${Math.round(delay / 60000)} min before next comment...`);
      await sleep(delay);
    }
  }
  return results;
}

module.exports = { runBotSession, fetchKarma };
