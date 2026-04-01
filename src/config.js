const FINANCE_SUBREDDITS = [
  "personalfinanceindia","StockMarketIndia","IndianStockMarket",
  "IndiaInvestments","IndianStreetBets","mutualfunds","MutualfundsIndia",
  "IndiaFinance","FIRE_Ind","DalalStreetTalks","IndiaAlgoTrading","StartInvestIN"
];
const ANIME_SUBREDDITS = [
  "anime","Animesuggest","whatanimetowatchnext","OnePiece","Naruto",
  "Jujutsukaisen","DemonSlayerAnime","attackontitan","Chainsaw_man",
  "hunterxhunter","spy_x_family","FullmetalAlchemist","vinlandSaga",
  "animememes","anime_irl","goodanimemes","DrStone","BlueLock",
  "overlord","AnimeReccomendations","dbz","MyHeroAcademia"
];
const YOUTUBE_SUBREDDITS = [
  "NewTubers","SmallYoutubers","youtubers","TinyYoutubers","GrowMyChannel","YouTubeCreators"
];
const GENERAL_SUBREDDITS = [
  "CasualConversation","mildlyinteresting","Showerthoughts","unpopularopinion","LifeProTips"
];
const FINANCE_TERMS = ["how to start","beginner","confused","help","SIP","index fund","question","advice"];
const ANIME_TERMS  = ["recommend","just finished","thoughts on","is it worth","unpopular opinion","best arc","underrated","suggest"];
const YOUTUBE_TERMS = ["subscribers","views","algorithm","struggling","milestone","rant","growth"];
const GENERAL_TERMS = ["anyone else","is it just me","unpopular opinion","advice"];

const CATEGORY_WEIGHTS = [
  { category:"ANIME",   subreddits:ANIME_SUBREDDITS,   terms:ANIME_TERMS,   weight:5 },
  { category:"FINANCE", subreddits:FINANCE_SUBREDDITS, terms:FINANCE_TERMS, weight:3 },
  { category:"YOUTUBE", subreddits:YOUTUBE_SUBREDDITS, terms:YOUTUBE_TERMS, weight:1 },
  { category:"GENERAL", subreddits:GENERAL_SUBREDDITS, terms:GENERAL_TERMS, weight:1 }
];

const ARCTIC_BASE = "https://arctic-shift.photon-reddit.com/api";
const COMMENTS_PER_RUN = 2;
const POST_MAX_AGE_HOURS = 4;
const POST_MAX_EXISTING_COMMENTS = 50;
const POST_MIN_SCORE = 1;
const HARD_EXCLUDES = [
  "portfolio review","rate my portfolio","review my portfolio",
  "which stocks","best stocks","multibagger","target price",
  "which app","which platform","should i buy","should i sell",
  "mods","mega thread","weekly thread","daily thread",
  "crypto","bitcoin","nft","web3"
];
const GAS_LOG_URL = process.env.GAS_LOG_URL || "";

module.exports = {
  FINANCE_SUBREDDITS,ANIME_SUBREDDITS,YOUTUBE_SUBREDDITS,GENERAL_SUBREDDITS,
  FINANCE_TERMS,ANIME_TERMS,YOUTUBE_TERMS,GENERAL_TERMS,
  CATEGORY_WEIGHTS,ARCTIC_BASE,COMMENTS_PER_RUN,
  POST_MAX_AGE_HOURS,POST_MAX_EXISTING_COMMENTS,POST_MIN_SCORE,
  HARD_EXCLUDES,GAS_LOG_URL
};
