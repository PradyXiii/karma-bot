const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");
puppeteer.use(StealthPlugin());
const fetch = require("node-fetch");
const DEBUG = process.env.DEBUG === "true";
function log(...a) { if (DEBUG) console.log("[redditBot]", ...a); }
function sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }
function jitter(min,max) { return sleep(min+Math.floor(Math.random()*(max-min))); }

async function humanType(page, selector, text) {
  await page.focus(selector);
  for (const char of text) await page.keyboard.type(char,{delay:40+Math.random()*80});
}

async function launchBrowser() {
  const browser = await puppeteer.launch({
    headless:"new",
    args:[
      "--no-sandbox","--disable-setuid-sandbox","--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas","--no-first-run","--no-zygote",
      "--disable-gpu","--window-size=1280,800"
    ]
  });
  const page = await browser.newPage();
  await page.setViewport({width:1280,height:800});
  await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
  await page.setRequestInterception(true);
  page.on("request", req => ["image","font","media"].includes(req.resourceType()) ? req.abort() : req.continue());
  return {browser, page};
}

async function loginReddit(page, username, password) {
  log("Logging in...");
  await page.goto("https://old.reddit.com/login",{waitUntil:"domcontentloaded",timeout:30000});
  await jitter(1500,3000);
  if (await page.$("a.logout")) { log("Already logged in."); return true; }
  try {
    await page.waitForSelector("#user_login",{timeout:10000});
    await humanType(page,"#user_login",username);
    await jitter(400,900);
    await humanType(page,"#passwd_login",password);
    await jitter(500,1200);
    await page.click("button.btn[type=submit]");
    await page.waitForNavigation({waitUntil:"domcontentloaded",timeout:20000});
    await jitter(1000,2000);
    if (!await page.$("a.logout")) {
      const errEl = await page.$(".error");
      const errText = errEl ? await page.evaluate(el=>el.innerText,errEl) : "unknown";
      log("Login failed:",errText); return false;
    }
    log("Login successful as",username); return true;
  } catch(e) { log("loginReddit error:",e.message); return false; }
}

async function postComment(page, postUrl, commentText) {
  const oldUrl = postUrl.replace("www.reddit.com","old.reddit.com");
  log("Posting to:",oldUrl);
  try {
    await page.goto(oldUrl,{waitUntil:"domcontentloaded",timeout:30000});
    await jitter(2000,4000);
    const sel = "div.usertext-edit textarea[name='text']";
    await page.waitForSelector(sel,{timeout:15000});
    await page.click(sel);
    await jitter(500,1000);
    await page.evaluate(s=>{document.querySelector(s).value="";},sel);
    await humanType(page,sel,commentText);
    await jitter(1000,2500);
    const submitSel = "div.usertext-edit .submit button[type='submit']";
    await page.waitForSelector(submitSel,{timeout:10000});
    await page.click(submitSel);
    await jitter(3000,5000);
    const content = await page.content();
    const found = content.includes(commentText.slice(0,40));
    if (found) { log("Comment posted successfully."); return {success:true}; }
    const errEl = await page.$(".error");
    const errText = errEl ? await page.evaluate(el=>el.innerText,errEl) : "";
    log("Post uncertain. Error:",errText);
    return {success:!errText.toLowerCase().includes("rate limit"), error:errText};
  } catch(e) { log("postComment error:",e.message); return {success:false,error:e.message}; }
}

async function fetchKarma(username) {
  try {
    const res = await fetch(`https://www.reddit.com/user/${encodeURIComponent(username)}/about.json`,
      {headers:{"User-Agent":"KarmaBot/1.0"},timeout:10000});
    if (!res.ok) return null;
    const data = await res.json();
    return {
      commentKarma: Number(data.data?.comment_karma||0),
      postKarma:    Number(data.data?.link_karma||0),
      total:        Number((data.data?.comment_karma||0)+(data.data?.link_karma||0))
    };
  } catch(e) { log("fetchKarma error:",e.message); return null; }
}

async function runBotSession(targets) {
  const username = process.env.REDDIT_USERNAME;
  const password = process.env.REDDIT_PASSWORD;
  if (!username||!password) throw new Error("REDDIT_USERNAME or REDDIT_PASSWORD not set.");
  const {browser,page} = await launchBrowser();
  const results = [];
  try {
    if (!await loginReddit(page,username,password)) throw new Error("Reddit login failed.");
    for (const target of targets) {
      const result = await postComment(page,target.postUrl,target.comment);
      results.push({...target, posted:result.success, error:result.error||null, postedAt:new Date().toISOString()});
      log(result.success ? `Posted: ${target.postTitle?.slice(0,60)}` : `Failed: ${result.error}`);
      if (targets.indexOf(target) < targets.length-1) {
        const delay = 180000+Math.floor(Math.random()*240000);
        log(`Waiting ${Math.round(delay/60000)} min before next comment...`);
        await sleep(delay);
      }
    }
  } finally { await browser.close(); }
  return results;
}

module.exports = {runBotSession, fetchKarma};
