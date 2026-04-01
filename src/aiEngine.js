const fetch = require("node-fetch");
const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-sonnet-4-5";
const DEBUG = process.env.DEBUG === "true";
function log(...a) { if (DEBUG) console.log("[aiEngine]", ...a); }

async function callClaude(system, user, maxTokens=180) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const res = await fetch(CLAUDE_API_URL, {
    method:"POST",
    headers:{
      "Content-Type":"application/json",
      "x-api-key": apiKey,
      "anthropic-version":"2023-06-01"
    },
    body:JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: maxTokens,
      system: system,
      messages:[{role:"user", content:user}]
    }),
    timeout:20000
  });
  if (!res.ok) { const e=await res.text(); throw new Error(`Claude ${res.status}: ${e.slice(0,200)}`); }
  return res.json();
}

async function assessPost(post, category) {
  const prompts = {
    ANIME:`Classify Reddit anime posts for commentable engagement. Accept (score>=6): episode/series discussion, recommendations, hot takes, "just finished", controversial opinions. Reject: art-only, cosplay-only, mod posts. Respond with JSON only, no other text: {"score":0-10,"reason":"short"}`,
    FINANCE:`Classify Indian finance Reddit posts. Accept (score>=6): beginner questions, conceptual confusion, "where to start", investment philosophy. Reject: stock tips, portfolio review, platform recs, buy/sell. Respond with JSON only, no other text: {"score":0-10,"reason":"short"}`,
    YOUTUBE:`Classify small YouTube creator posts. Accept (score>=6): milestone posts, algorithm rants, growth struggles, burnout. Reject: channel promos, sub4sub. Respond with JSON only, no other text: {"score":0-10,"reason":"short"}`,
    GENERAL:`Classify for commentable engagement. Accept (score>=6): relatable experiences, hot takes, genuine life questions. Reject: political flamebait, mod posts. Respond with JSON only, no other text: {"score":0-10,"reason":"short"}`
  };
  try {
    const data = await callClaude(
      prompts[category]||prompts.GENERAL,
      `SUBREDDIT: r/${post.subreddit}\nTITLE: ${String(post.title).slice(0,300)}\nBODY: ${String(post.body).slice(0,500)}`,
      80
    );
    const raw = String(data.content?.[0]?.text||"{}").replace(/```json|```/g,"").trim();
    const r = JSON.parse(raw);
    log(`Assess r/${post.subreddit}: score=${r.score}`);
    return {score:Number(r.score||0), reason:r.reason||""};
  } catch(e) { log("assessPost error:",e.message); return {score:0,reason:"error"}; }
}

const ANIME_PERSONA = `You are a real person who has watched over 400 anime. You have genuine opinions and are not afraid to push back gently. Mild self-deprecating humor is part of your personality.

Writing a SHORT Reddit comment on an anime post.

RULES:
- 2 to 4 lines MAX. One or two short paragraphs. Blank line between paragraphs if two.
- Sound like a real person typing casually. Not a reviewer or blogger.
- Have an actual opinion. Name specific shows, arcs, episodes when relevant.
- English only.
- NO: em dashes, bullet points, bold text, numbered lists.
- NO: "certainly", "absolutely", "great post", "hope this helps", "as an AI".
- NO: links, URLs, promotional content.
- NO: ChatGPT-sounding language. Ever.`;

const FINANCE_PERSONA = `You are a regular Indian retail investor. Been in the market long enough to survive a few crashes. Not an advisor — just someone who figured things out the hard way.

Writing a SHORT Reddit comment on an Indian finance post.

RULES:
- 2 to 4 lines MAX. One or two short paragraphs.
- Sound like a real Indian person on Reddit. Casual, direct.
- Hinglish VERY sparingly, only where natural: "yaar", "bhai", "seedha baat". Don't force it.
- Very mild sass is fine. Honest like a friend who's been through it.
- Add actual value. Cut through the noise.
- NO: stock tips, price targets, buy/sell advice, broker/app recommendations.
- NO: "this is not financial advice" disclaimers.
- NO: em dashes, bullet points, bold, numbered lists.
- NO: links or URLs. NO ChatGPT language.`;

const YOUTUBE_PERSONA = `You are someone who understands the YouTube creator grind deeply. Not a coach. Not a motivator. Just someone who gets it.

Writing a SHORT Reddit comment on a small creator's post.

RULES:
- 2 to 4 lines MAX.
- Genuine and grounded. NOT "you got this!" energy.
- Mild self-deprecating humor fine.
- If sharing insight, make it specific — not vague.
- English only.
- NO: em dashes, bullets, numbered lists.
- NO: "Keep grinding", "Stay consistent", "value value value", growth guru language.
- NO: links, channel recs, URLs. NO ChatGPT language.`;

const GENERAL_PERSONA = `You are a thoughtful, mildly witty person on Reddit. You have opinions. You add to conversations rather than just agreeing.

Writing a SHORT Reddit comment.

RULES:
- 2 to 3 lines MAX.
- Real person. Casual. Slightly funny if the topic allows.
- Add something to the conversation — don't just validate.
- English only.
- NO: em dashes, bullets, lists, links. NO ChatGPT language.`;

const PERSONAS = {ANIME:ANIME_PERSONA, FINANCE:FINANCE_PERSONA, YOUTUBE:YOUTUBE_PERSONA, GENERAL:GENERAL_PERSONA};

function sanitize(text) {
  let t = String(text||"");
  t = t.replace(/https?:\/\/[^\s]+/gi,"");
  t = t.replace(/\[([^\]]+)\]\([^)]+\)/g,"$1");
  t = t.replace(/\u2014|\u2013/g,",");
  [/^certainly[,!.]?\s*/i,/^absolutely[,!.]?\s*/i,/^great (post|question|point)[,!.]?\s*/i,/hope this helps/gi,/as an ai/gi,/i'd be happy to/gi].forEach(p=>{t=t.replace(p,"");});
  t = t.replace(/\n{3,}/g,"\n\n").replace(/[ \t]+$/gm,"").trim();
  return t;
}

async function generateComment(post, category) {
  const systemPrompt = PERSONAS[category]||PERSONAS.GENERAL;
  const userPrompt = `Subreddit: r/${post.subreddit}\nPost title: ${String(post.title).slice(0,300)}\nPost body: ${String(post.body).slice(0,700)}\n\nWrite the comment now. 2-4 lines max. No links. Genuine.`;
  try {
    const data = await callClaude(systemPrompt, userPrompt, 180);
    let comment = String(data.content?.[0]?.text||"").trim();
    comment = sanitize(comment);
    if (!comment || comment.split(/\s+/).length < 10) { log("Comment too short, discarding"); return null; }
    log("Generated:",comment.slice(0,80)+"...");
    return comment;
  } catch(e) { log("generateComment error:",e.message); return null; }
}

module.exports = {assessPost, generateComment};
