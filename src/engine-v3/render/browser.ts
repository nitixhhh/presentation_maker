/** Engine v3 — shared headless Chromium (Playwright). */
import { chromium, type Browser, type Page } from "playwright";
import fs from "fs";
import path from "path";
import { pathToFileURL } from "url";

let browserPromise: Promise<Browser> | null = null;

/** LOW_MEMORY=true (small hosts, e.g. 512 MB): one Chromium page at a time and lighter Chromium flags. */
export const LOW_MEMORY = process.env.LOW_MEMORY === "true";
/** how many slides render in parallel (RENDER_CONCURRENCY overrides; LOW_MEMORY → 1) */
export function renderLimit(def: number): number {
  const n = Number(process.env.RENDER_CONCURRENCY);
  if (n > 0) return Math.floor(n);
  return LOW_MEMORY ? 1 : def;
}

export async function getBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const low = LOW_MEMORY ? ["--disable-dev-shm-usage", "--disable-gpu", "--no-zygote", "--renderer-process-limit=1", "--disable-extensions", "--js-flags=--max-old-space-size=128"] : [];
    browserPromise = chromium.launch({ headless: true, args: ["--font-render-hinting=none", "--disable-lcd-text", ...low] });
    browserPromise.catch(() => (browserPromise = null));
  }
  const b = await browserPromise;
  if (!b.isConnected()) {
    browserPromise = null;
    return getBrowser();
  }
  return b;
}

export async function closeBrowser() {
  if (browserPromise) {
    const b = await browserPromise.catch(() => null);
    browserPromise = null;
    await b?.close().catch(() => {});
  }
}

/** Write a slide document into the deck's render dir and open it (file:// so local assets load). */
export async function openSlide(docHtml: string, renderDir: string, name: string, scale = 1): Promise<Page> {
  fs.mkdirSync(renderDir, { recursive: true });
  const file = path.join(renderDir, `${name}.html`);
  fs.writeFileSync(file, docHtml);
  const browser = await getBrowser();
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: scale });
  const page = await ctx.newPage();
  await page.goto(pathToFileURL(file).href, { waitUntil: "load", timeout: 45000 }).catch(() => {});
  // components (diagrams) draw after web fonts load; measuring before that would capture a stale layout
  await page.waitForFunction("window.__v3ready !== false", undefined, { timeout: 15000 }).catch(() => {});
  await page.evaluate(async () => {
    await (document as any).fonts?.ready;
    await Promise.all(
      Array.from(document.images).map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; })))
    );
  }).catch(() => {});
  await page.waitForTimeout(150);
  return page;
}

export async function closePage(page: Page) {
  await page.context().close().catch(() => {});
}

/** Simple async pool */
export async function pool<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  });
  await Promise.all(workers);
  return out;
}
