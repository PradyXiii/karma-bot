/**
 * Karma Bot — Google Apps Script Logger
 *
 * DEPLOYMENT:
 * 1. Go to script.google.com, open (or create) a project bound to your Google Sheet.
 *    If using a standalone script, set SPREADSHEET_ID below to your sheet's ID.
 * 2. Paste this file as Logger.gs (replace existing Code.gs if needed).
 * 3. Deploy > New Deployment > Web App
 *      Execute as: Me
 *      Who has access: Anyone
 * 4. Copy the /exec URL and set it as GAS_LOG_URL in your bot's environment (.env or GitHub Secrets).
 * 5. When re-deploying after changes, always create a "New Deployment" so the URL updates.
 *
 * SHEET STRUCTURE:
 *   Tab "Comments Log"  — one row per comment attempt
 *   Tab "Karma Tracker" — one row per bot run (karma snapshot + deltas)
 */

// Only needed for standalone scripts. Leave empty if script is bound to a sheet.
var SPREADSHEET_ID = "";

// ─── Column definitions (1-based for getRange, 0-based for array access) ──────

var COMMENTS_HEADERS = [
  "Row ID", "Timestamp (IST)", "Subreddit", "Category",
  "Post Title", "Post URL", "Comment Text", "AI Score",
  "AI Reason", "Posted?", "Error", "Post Upvotes",
  "Post Comments", "Week Number"
];
// 0-based indices into a data row fetched via getValues()
var CI_POSTED = 9;  // "Posted?" column
var CI_WEEK   = 13; // "Week Number" column

var KARMA_HEADERS = [
  "Timestamp (IST)", "Week", "Comment Karma", "Post Karma",
  "Total Karma", "Comment Delta (vs prev)", "Post Delta (vs prev)",
  "Total Delta (vs prev)", "Comments Posted This Week"
];
// 0-based indices into a karma row
var KI_COMMENT_KARMA = 2;
var KI_POST_KARMA    = 3;
var KI_TOTAL_KARMA   = 4;

// ─── Entry point ──────────────────────────────────────────────────────────────

function doPost(e) {
  if (!e || !e.postData || !e.postData.contents) {
    return jsonResponse({ status: "error", message: "No POST body received" });
  }
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.action === "LOG_COMMENT") {
      handleLogComment(data);
    } else if (data.action === "UPDATE_KARMA") {
      handleUpdateKarma(data);
    } else {
      return jsonResponse({ status: "error", message: "Unknown action: " + data.action });
    }
    return jsonResponse({ status: "ok" });
  } catch (err) {
    return jsonResponse({ status: "error", message: err.toString() });
  }
}

// ─── Action handlers ──────────────────────────────────────────────────────────

function handleLogComment(data) {
  var sheet    = getOrCreateSheet("Comments Log", COMMENTS_HEADERS);
  var istStr   = toIST(data.timestamp);
  var istDate  = new Date(data.timestamp);
  var weekNum  = getISOWeek(istDate);

  sheet.appendRow([
    data.rowId        || "",
    istStr,
    data.subreddit    || "",
    data.category     || "",
    (data.postTitle   || "").slice(0, 200),
    data.postUrl      || "",
    data.comment      || "",
    Number(data.aiScore) || 0,
    data.aiReason     || "",
    data.posted       || "NO",
    data.error        || "",
    Number(data.postScore)    || 0,
    Number(data.numComments)  || 0,
    weekNum
  ]);
}

function handleUpdateKarma(data) {
  var karmaSheet = getOrCreateSheet("Karma Tracker", KARMA_HEADERS);
  var istStr     = toIST(data.timestamp);
  var istDate    = new Date(data.timestamp);
  var weekNum    = getISOWeek(istDate);

  var commentKarma = Number(data.commentKarma) || 0;
  var postKarma    = Number(data.postKarma)    || 0;
  var totalKarma   = Number(data.totalKarma)   || 0;

  // Deltas vs previous row
  var commentDelta = "";
  var postDelta    = "";
  var totalDelta   = "";
  var lastRow = karmaSheet.getLastRow();
  if (lastRow > 1) { // has at least one data row beyond header
    var prevValues = karmaSheet.getRange(lastRow, 1, 1, KARMA_HEADERS.length).getValues()[0];
    commentDelta = commentKarma - (Number(prevValues[KI_COMMENT_KARMA]) || 0);
    postDelta    = postKarma    - (Number(prevValues[KI_POST_KARMA])    || 0);
    totalDelta   = totalKarma   - (Number(prevValues[KI_TOTAL_KARMA])   || 0);
  }

  var commentsThisWeek = countCommentsThisWeek(weekNum);

  karmaSheet.appendRow([
    istStr,
    weekNum,
    commentKarma,
    postKarma,
    totalKarma,
    commentDelta,
    postDelta,
    totalDelta,
    commentsThisWeek
  ]);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the sheet with the given name, creating it (with frozen headers) if absent.
 */
function getOrCreateSheet(name, headers) {
  var ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();

  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
    var headerRange = sheet.getRange(1, 1, 1, headers.length);
    headerRange.setValues([headers]);
    headerRange.setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
  }
  return sheet;
}

/**
 * Converts a UTC ISO string to an IST formatted string: "yyyy-MM-dd HH:mm:ss".
 */
function toIST(isoString) {
  try {
    return Utilities.formatDate(new Date(isoString), "Asia/Calcutta", "yyyy-MM-dd HH:mm:ss");
  } catch (e) {
    return isoString || "";
  }
}

/**
 * Returns the ISO 8601 week number for a given Date object.
 * Week 1 is the week containing the first Thursday of the year.
 */
function getISOWeek(date) {
  var d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  var dayNum = d.getUTCDay() || 7; // treat Sunday (0) as 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // shift to Thursday of this week
  var yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Counts rows in "Comments Log" where Posted? = "YES" and Week = weekNum.
 * Returns 0 if the tab doesn't exist yet.
 */
function countCommentsThisWeek(weekNum) {
  var ss = SPREADSHEET_ID
    ? SpreadsheetApp.openById(SPREADSHEET_ID)
    : SpreadsheetApp.getActiveSpreadsheet();

  var sheet = ss.getSheetByName("Comments Log");
  if (!sheet || sheet.getLastRow() < 2) return 0;

  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, COMMENTS_HEADERS.length).getValues();
  var count = 0;
  for (var i = 0; i < data.length; i++) {
    if (String(data[i][CI_POSTED]) === "YES" && Number(data[i][CI_WEEK]) === weekNum) {
      count++;
    }
  }
  return count;
}

/**
 * Builds a JSON ContentService response.
 */
function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
