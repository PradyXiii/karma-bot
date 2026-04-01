const fetch = require("node-fetch");
const { ARCTIC_BASE, POST_MAX_AGE_HOURS, POST_MAX_EXISTING_COMMENTS, POST_MIN_SCORE, HARD_EXCLUDES } = require("./config");
const DEBUG = process.env.DEBUG === "true";
function log(...a) { if (DEBUG) console.log("[fetchPosts]", ...a); }
function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }

function normalizeUrl(permalink) {
  const p = String(permalink||"").trim();
  if (!p) return "";
  const base = p.startsWith("http") ? p : "https://www.reddit.com"+p;
  return base.endsWith("/") ? base : base+"/";
}

function isPostFresh(createdUtc) {
  return (Date.now()/1000 - Number(createdUtc||0)) < POST_MAX_AGE_HOURS * 3600;
}

function passesHardFilters(title, body) {
  const text = (String(title||"")+" "+String(body||"")).toLowerCase();
  return !HARD_EXCLUDES.some(x=>text.includes(x));
}

function shuffle(arr) {
  const a=[...arr];
  for (let i=a.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}

async function arcticGet(url) {
  try {
    let res = await fetch(url, {headers:{"User-Agent":"KarmaBot/1.0"},timeout:12000});
    if (res.status===429) { log("Rate limited, sleeping 20s..."); await sleep(20000); res = await fetch(url,{headers:{"User-Agent":"KarmaBot/1.0"},timeout:12000}); }
    if (!res.ok) { log(`Non-200: ${res.status}`); return null; }
    return res.json();
  } catch(e) { log("arcticGet error:",e.message); return null; }
}

async function fetchPostsForCategory(subreddits, terms, maxPosts=5) {
  const results=[], seen=new Set();
  const subs  = shuffle(subreddits).slice(0,5);
  const term  = shuffle(terms)[0];

  for (const subreddit of subs) {
    if (results.length >= maxPosts) break;
    const url = `${ARCTIC_BASE}/posts/search?subreddit=${encodeURIComponent(subreddit)}&title=${encodeURIComponent(term)}&limit=25&sort=desc&sort_type=created_utc&after=4h`;
    const data = await arcticGet(url);
    await sleep(2500);
    if (!data || !Array.isArray(data.data)) continue;

    for (const p of data.data) {
      if (results.length >= maxPosts) break;
      const post = {
        id:          String(p.id||""),
        title:       String(p.title||"").trim(),
        body:        String(p.selftext||"").trim(),
        link:        normalizeUrl(p.permalink),
        score:       Number(p.score||0),
        numComments: Number(p.num_comments||0),
        createdUtc:  Number(p.created_utc||0),
        subreddit:   String(p.subreddit||subreddit).trim()
      };
      if (!post.title||!post.link||!post.id) continue;
      if (!isPostFresh(post.createdUtc)) continue;
      if (post.numComments > POST_MAX_EXISTING_COMMENTS) continue;
      if (post.score < POST_MIN_SCORE) continue;
      if (!passesHardFilters(post.title, post.body)) continue;
      if (!seen.has(post.id)) { seen.add(post.id); results.push(post); }
    }
    log(`r/${subreddit} + "${term}" → ${results.length} so far`);
  }
  return results;
}

async function alreadyCommented(postId, ourUsernames) {
  for (const username of ourUsernames) {
    const url = `${ARCTIC_BASE}/comments/search?link_id=${encodeURIComponent("t3_"+postId)}&author=${encodeURIComponent(username)}&limit=1`;
    const data = await arcticGet(url);
    if (data && Array.isArray(data.data) && data.data.length>0) { log(`Already commented as ${username}`); return true; }
    await sleep(1000);
  }
  return false;
}

module.exports = { fetchPostsForCategory, alreadyCommented };
