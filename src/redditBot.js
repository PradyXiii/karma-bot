async function loginReddit(page, username, password) {
  log("Logging in...");
  
  // Try old reddit login URL with credentials in URL first
  await page.goto("https://old.reddit.com/login/?dest=https%3A%2F%2Fold.reddit.com%2F", 
    {waitUntil:"networkidle2", timeout:30000});
  await jitter(2000, 4000);

  // Check if already logged in
  if (await page.$("a.logout")) { log("Already logged in."); return true; }

  try {
    // Wait longer for the form
    await page.waitForSelector("#user_login", {timeout:15000});
    await page.click("#user_login");
    await jitter(500, 1000);
    await humanType(page, "#user_login", username);
    await jitter(400, 900);
    await page.click("#passwd_login");
    await jitter(300, 600);
    await humanType(page, "#passwd_login", password);
    await jitter(800, 1500);
    
    // Take screenshot before submit for debugging
    await page.screenshot({path:"/tmp/before-login.png"});
    
    await page.click("button.btn[type=submit]");
    await page.waitForNavigation({waitUntil:"networkidle2", timeout:25000});
    await jitter(2000, 3000);

    await page.screenshot({path:"/tmp/after-login.png"});

    if (!await page.$("a.logout")) {
      const errEl = await page.$(".error");
      const errText = errEl ? await page.evaluate(el=>el.innerText, errEl) : "no logout link found";
      log("Login failed:", errText); 
      return false;
    }
    log("Login successful as", username); 
    return true;
  } catch(e) { 
    await page.screenshot({path:"/tmp/login-error.png"}).catch(()=>{});
    log("loginReddit error:", e.message); 
    return false; 
  }
}
