const { CATEGORY_WEIGHTS, COMMENTS_PER_RUN } = require("./config");
const { fetchPostsForCategory, alreadyCommented } = require("./fetchPosts");
const { assessPost, generateComment } = require("./aiEngine");
const { runBotSession, fetchKarma } = require("./redditBot");
const { logComment, updateKarmaTracker } = require("./sheetsLogger");

const DRY_RUN = process.argv.includes("--dry-run");
const DEBUG = process.env.DEBUG === "true";
function log(...a) { console.log("[index]", ...a); }
function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }

function pickCategory() {
  const pool = [];
  for (const c of CATEGORY_WEIGHTS) for (let i=0;i<c.weight;i++) pool.push(c);
  return pool[Math.floor(Math.random()*pool.length)];
}

async function main() {
  log(`=== Karma Bot Starting — DRY_RUN=${DRY_RUN} ===`);
  const username = process.env.REDDIT_USERNAME;
  if (!username && !DRY_RUN) { log("REDDIT_USERNAME not set. Exiting."); process.exit(1); }

  const targets = [];
  const maxAttempts = COMMENTS_PER_RUN * 6;
  let attempts = 0;

  while (targets.length < COMMENTS_PER_RUN && attempts < maxAttempts) {
    attempts++;
    const category = pickCategory();
    log(`Attempt ${attempts}: Category=${category.category}`);

    const posts = await fetchPostsForCategory(category.subreddits, category.terms, 5);
    if (!posts.length) { log("No posts fetched, skipping."); continue; }

    const post = posts[Math.floor(Math.random()*posts.length)];
    log(`Candidate: r/${post.subreddit} — "${post.title.slice(0,70)}"`);

    if (username) {
      const dupe = await alreadyCommented(post.id, [username]);
      if (dupe) { log("Already commented, skipping."); continue; }
    }

    const assessment = await assessPost(post, category.category);
    if (assessment.score < 6) { log(`Score too low (${assessment.score}), skipping.`); await sleep(1000); continue; }

    const comment = await generateComment(post, category.category);
    if (!comment) { log("Generation failed, skipping."); continue; }

    targets.push({
      postUrl:     post.link,
      postTitle:   post.title,
      postId:      post.id,
      subreddit:   post.subreddit,
      category:    category.category,
      comment,
      aiScore:     assessment.score,
      aiReason:    assessment.reason,
      postScore:   post.score,
      numComments: post.numComments
    });
    log(`Target ${targets.length}/${COMMENTS_PER_RUN} ready.`);
    await sleep(2000);
  }

  if (!targets.length) { log("No suitable targets found. Exiting."); return; }

  log(`\n--- Targets: ${targets.length} ---`);
  for (const t of targets) {
    log(` [${t.category}] r/${t.subreddit}: ${t.postTitle.slice(0,60)}`);
    log(`  Comment: ${t.comment.replace(/\n/g," ").slice(0,120)}`);
  }

  if (DRY_RUN) {
    log("\nDRY RUN — skipping actual posting.");
    for (const t of targets) await logComment({...t, posted:false, error:"DRY_RUN"});
  } else {
    const results = await runBotSession(targets);
    for (const r of results) {
      await logComment(r);
      log(r.posted ? `POSTED: ${r.postUrl}` : `FAILED: ${r.error}`);
    }
    log(`\nRun complete. Posted: ${results.filter(r=>r.posted).length}/${targets.length}`);
  }

  if (username && !DRY_RUN) {
    const karma = await fetchKarma(username);
    if (karma) {
      log(`Karma: comment=${karma.commentKarma} post=${karma.postKarma} total=${karma.total}`);
      await updateKarmaTracker(karma);
    }
  }
  log("=== Run finished ===");
}

main().catch(e=>{ console.error("[index] Fatal:",e); process.exit(1); });
