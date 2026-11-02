/** try a v5 slide edit on a local deck: tsx scripts/v5-edit-test.ts <dataDir> <deckId> <n> "<instruction>" */
const [dataDir, id, n, ins] = process.argv.slice(2);
process.env.DECKCRAFT_DATA_DIR = dataDir;
(async () => {
  const { loadDeck } = await import("../src/engine-v3/store");
  const { editSlideV5 } = await import("../src/engine-v5/edit");
  const { llmContext } = await import("../src/engine-v3/llm");
  const deck = loadDeck(id)!;
  const before = (deck.slides.find((s) => s.n === Number(n)) as any)?.v5?.content?.template;
  const t0 = Date.now();
  const stats: any[] = [];
  await llmContext.run({ stats, onWait: () => {} } as any, () => editSlideV5(deck, Number(n), ins, (a, b, c) => console.log("[edit]", a, b, c)));
  const after = (deck.slides.find((s) => s.n === Number(n)) as any)?.v5?.content;
  console.log("RESULT " + JSON.stringify({ before, after: after?.template, title: after?.title, seconds: (Date.now() - t0) / 1000, calls: stats.length }));
  process.exit(0);
})().catch((e) => { console.error("EDIT FAILED", e); process.exit(1); });
