
const { chromium } = require("playwright");
const fs = require("fs");
const OUT = process.env.OUT || "/tmp/v6run/ui"; fs.mkdirSync(OUT, { recursive: true });
const log = (m) => { fs.appendFileSync(OUT + "/ui.log", new Date().toISOString() + " " + m + "\n"); };
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await ctx.addInitScript(() => { try { localStorage.setItem("dc_age_ok", "1"); } catch {} });
  const p = await ctx.newPage();
  let k = 0;
  const shot = async (name, full = false) => { k++; await p.screenshot({ path: `${OUT}/${String(k).padStart(2, "0")}-${name}.png`, fullPage: full }); log("shot " + name); };
  try {
    await p.goto("http://localhost:3999/create", { waitUntil: "domcontentloaded" }); await p.waitForSelector('[placeholder^="e.g. UV-Visible"]', { timeout: 60000 }).catch(async () => { await p.locator("text=/Make|Create|Start/i").first().click().catch(() => {}); await p.waitForSelector('[placeholder^="e.g. UV-Visible"]', { timeout: 30000 }); }); await p.waitForTimeout(1500);
    await shot("home");
    const topic = p.locator('textarea, input').filter({ has: p.locator(':scope') }).first();
    await p.locator('[placeholder^="e.g. UV-Visible"]').fill("The Economics of Inequality: Is Wealth Distribution More Important Than Economic Growth?");
    await p.locator('button:has-text("Title slide and college format")').click().catch(() => {}); await p.waitForTimeout(500);
    await p.locator('[placeholder="Presented by (names)"]').fill("Nitish Yadav").catch(() => {});
    await p.locator('[placeholder="Roll no."]').fill("135").catch(() => {});
    await p.locator('[placeholder="Course / semester"]').fill("Business").catch(() => {});
    await p.locator('[placeholder="College / university"]').fill("Brainware University").catch(() => {});
    await shot("create-filled", true);
    await p.keyboard.press('Escape').catch(() => {}); const age = p.locator('#age-confirm input, input[type=checkbox]'); if (await age.count()) await age.first().check().catch(() => {}); await p.locator('button[type="submit"]').click();
    await p.waitForTimeout(20000); await shot("plan-progress");
    await p.waitForSelector("text=Step 1 of 2", { timeout: 480000 });
    await p.waitForTimeout(1500);
    await shot("plan-cards"); await shot("plan-cards-full", true);
    // open slide 3 to edit
    const cards = p.locator("ol > li"); await cards.nth(2).locator("button").first().click(); await p.waitForTimeout(600);
    await cards.nth(2).scrollIntoViewIfNeeded(); await shot("plan-edit-card");
    await cards.nth(2).locator("button").first().click(); await p.waitForTimeout(300);
    await p.locator("text=Looks good, choose a style").click(); await p.waitForTimeout(1200);
    await shot("style-surprise");
    await p.locator('button:has-text("Choose")').first().click(); await p.waitForTimeout(2500);
    await shot("style-choose"); await shot("style-choose-full", true);
    if (!process.env.NO_MORE) { const more = p.locator('button:has-text("Suggest another")'); await more.scrollIntoViewIfNeeded(); await more.click(); await p.waitForSelector('button:has-text("Suggest another"):not([disabled])', { timeout: 240000 }); await p.waitForTimeout(2500); await p.evaluate(() => window.scrollTo(0, 0)); await shot("style-more"); }
    await p.locator('button:has-text("Surprise me")').first().click(); await p.waitForTimeout(300);
    const gen = p.locator('button:has-text("Generate my")'); await gen.scrollIntoViewIfNeeded(); await shot("style-ready");
    await gen.click();
    await p.waitForTimeout(25000); await shot("generate-live");
    await p.waitForTimeout(40000); await shot("generate-live-2");
    await p.waitForSelector('[placeholder^="e.g. “make slide"]', { timeout: 600000 });
    await p.waitForTimeout(3000); await shot("deck-ready"); await shot("deck-ready-full", true);
    if (!process.env.NO_EDIT) {
      const box = p.locator('[placeholder^="e.g. “make slide"]'); await box.scrollIntoViewIfNeeded(); await box.fill("make slide 3 a timeline");
      await shot("chat-edit-typed");
      await p.locator('button:has-text("Send")').click(); await p.waitForTimeout(8000); await shot("chat-edit-working");
      await p.waitForFunction(() => !document.body.innerText.includes("Changing slide") && !document.body.innerText.includes("Rewriting"), null, { timeout: 300000 }).catch(() => {});
      await p.waitForTimeout(4000); await shot("chat-edit-done"); await shot("chat-edit-done-full", true);
    }
    log("DONE url " + p.url());
  } catch (e) { log("ERR " + (e && e.stack || e)); await shot("error").catch(() => {}); }
  await b.close();
})();
