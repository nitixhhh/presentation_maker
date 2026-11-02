import { test } from "node:test";
import assert from "node:assert/strict";
import { searchIcons, getIcon, findIcon, expandIconPlaceholders, sanitizeSvg, iconLibraryInfo } from "./icons";

const top = (q: string, n = 3) => searchIcons(q, n).map((h) => h.name);

test("bundle loads with both sets", () => {
  const info = iconLibraryInfo();
  assert.ok(info.counts.lucide > 1500, "lucide count");
  assert.ok(info.counts.tabler > 4000, "tabler count");
  assert.equal(info.sets.lucide.license, "ISC");
  assert.equal(info.sets.tabler.license, "MIT");
});

test("core presentation concepts find the right icon first", () => {
  const expect: Record<string, string[]> = {
    gpu: ["gpu"], cpu: ["cpu"], planet: ["planet"], earth: ["earth"], rocket: ["rocket"], atom: ["atom"],
    dna: ["dna"], brain: ["brain"], heart: ["heart"], rupee: ["indian-rupee"], "arrow right": ["arrow-right"],
    warning: ["triangle-alert"], idea: ["lightbulb"], graduation: ["graduation-cap"], factory: ["factory"],
    wifi: ["wifi"], lock: ["lock"], clock: ["clock"], calendar: ["calendar"], globe: ["globe"],
  };
  for (const [q, want] of Object.entries(expect)) {
    assert.ok(want.includes(top(q, 1)[0]), `${q} -> ${top(q, 3).join(",")}`);
  }
});

test("synonyms, Hinglish and phrases", () => {
  assert.ok(top("paisa").includes("indian-rupee"));
  assert.ok(top("padhai").some((n) => ["graduation-cap", "school", "book-open"].includes(n)));
  assert.ok(top("graphics card").includes("gpu"));
  assert.ok(top("chart up").some((n) => n.startsWith("trending-up") || n.startsWith("chart")));
  assert.ok(top("machine learning").includes("brain-circuit"));
  assert.ok(!top("machine learning", 5).includes("graduation-cap"), "phrase should not leak 'learning' -> education");
  assert.ok(top("vigyan").some((n) => ["microscope", "flask-conical", "atom"].includes(n)));
});

test("variants and brands are demoted", () => {
  assert.ok(!top("telescope", 1)[0].endsWith("-off"));
  assert.ok(!top("planet", 3).some((n) => n.startsWith("brand-")));
  assert.ok(searchIcons("github logo", 3).some((h) => h.name === "brand-github"));
});

test("filled style search only returns filled icons", () => {
  const hits = searchIcons("star", 5, { style: "filled" });
  assert.ok(hits.length > 0);
  assert.ok(hits.every((h) => h.set === "tabler-filled"));
});

test("getIcon returns clean inline svg", () => {
  const svg = getIcon("lucide:cpu", { size: 64, color: "#2563eb", stroke: 1.5, title: "Processor" })!;
  assert.match(svg, /^<svg [^>]*viewBox="0 0 24 24"/);
  assert.match(svg, /width="64" height="64"/);
  assert.match(svg, /stroke="#2563eb"/);
  assert.match(svg, /stroke-width="1.5"/);
  assert.match(svg, /<title>Processor<\/title>/);
  assert.doesNotMatch(svg, /<script|on\w+=/i);
  assert.equal(getIcon("definitely-not-an-icon"), null);
});

test("bare names, aliases and set preference resolve", () => {
  assert.equal(findIcon("cpu")!.set, "lucide");
  assert.equal(findIcon("cpu", "tabler")!.set, "tabler");
  assert.equal(findIcon("planet")!.set, "tabler"); // only in Tabler
  assert.equal(findIcon("smile")!.name, "face-slightly-smiling"); // old Lucide name
  assert.equal(findIcon("Arrow Right")!.name, "arrow-right");
});

test("hostile options are neutralised", () => {
  const svg = getIcon("heart", { color: 'red" onload="alert(1)', size: "99999px" as unknown as number, style: "background:url(https://x)" })!;
  assert.doesNotMatch(svg, /onload|alert|url\(/);
  assert.match(svg, /stroke="currentColor"/);
  assert.match(svg, /width="48"/);
});

test("filled icons render with fill, not stroke", () => {
  const svg = getIcon("tabler-filled:star", { color: "#f59e0b" })!;
  assert.match(svg, /fill="#f59e0b"/);
  assert.match(svg, /stroke="none"/);
});

test("placeholders expand to inline svg", () => {
  const { html, used, missing } = expandIconPlaceholders(
    '<div><i data-icon="gpu" data-size="40" data-color="#0ea5e9"></i> GPU <i data-icon="paisa"></i><span data-icon="zzqqxx"></span></div>');
  assert.equal(used[0], "lucide:gpu");
  assert.equal(used[1], "lucide:indian-rupee"); // unknown name -> best search hit
  assert.deepEqual(missing, ["zzqqxx"]);
  assert.match(html, /<svg[^>]*width="40"[^>]*stroke="#0ea5e9"/);
  assert.doesNotMatch(html, /data-icon="zzqqxx"/);
});

test("sanitizeSvg strips scripts and handlers", () => {
  const dirty = '<svg onload="x()"><script>alert(1)</script><path d="M0 0" onclick="y()"/><foreignObject><div/></foreignObject></svg>';
  const clean = sanitizeSvg(dirty);
  assert.doesNotMatch(clean, /script|onload|onclick|foreignObject/i);
  assert.match(clean, /<path d="M0 0"\/>/);
});


test("search is fast enough for tool calls", () => {
  searchIcons("warmup");
  const t0 = performance.now();
  for (const q of ["gpu", "chart up", "user group", "paisa", "climate change", "arrow right"]) searchIcons(q, 8);
  const per = (performance.now() - t0) / 6;
  assert.ok(per < 100, `avg ${per.toFixed(1)} ms/query`);
});
