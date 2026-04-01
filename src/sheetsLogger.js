const fetch = require("node-fetch");
const DEBUG = process.env.DEBUG === "true";
function log(...a) { if (DEBUG) console.log("[sheetsLogger]", ...a); }
function randomId() { return Math.random().toString(36).slice(2,10).toUpperCase(); }

function getGasUrl() {
  const url = process.env.GAS_LOG_URL;
  if (!url) { log("WARNING: GAS_LOG_URL not set. Logging skipped."); return null; }
  return url;
}

async function logComment(data) {
  const gasUrl = getGasUrl();
  if (!gasUrl) return;
  const payload = {
    action:       "LOG_COMMENT",
    rowId:        `RID-${randomId()}`,
    timestamp:    new Date().toISOString(),
    subreddit:    data.subreddit   || "",
    category:     data.category    || "",
    postTitle:    (data.postTitle  || "").slice(0,200),
    postUrl:      data.postUrl     || "",
    comment:      data.comment     || "",
    aiScore:      data.aiScore     || 0,
    aiReason:     data.aiReason    || "",
    posted:       data.posted      ? "YES" : "NO",
    error:        data.error       || "",
    postScore:    data.postScore   || 0,
    numComments:  data.numComments || 0
  };
  try {
    const res = await fetch(gasUrl, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload),
      timeout:10000
    });
    log("Log response:", res.status);
  } catch(e) { log("logComment error:",e.message); }
}

async function updateKarmaTracker(karmaData) {
  const gasUrl = getGasUrl();
  if (!gasUrl || !karmaData) return;
  const payload = {
    action:       "UPDATE_KARMA",
    timestamp:    new Date().toISOString(),
    commentKarma: karmaData.commentKarma || 0,
    postKarma:    karmaData.postKarma    || 0,
    totalKarma:   karmaData.total        || 0
  };
  try {
    const res = await fetch(gasUrl, {
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify(payload),
      timeout:10000
    });
    log("Karma tracker update:", res.status);
  } catch(e) { log("updateKarmaTracker error:",e.message); }
}

module.exports = {logComment, updateKarmaTracker};
