/** Engine v7 prototype runner: tsx scripts/v7-design.ts '<request json>' <out dir> */
import { generateDeckV7 } from "../src/engine-v7/pipeline";
const req = JSON.parse(process.argv[2]);
const dir = process.argv[3];
generateDeckV7(req, { dir, concurrency: Number(process.env.V7_CONCURRENCY || 3), fixRounds: Number(process.env.V7_FIX_ROUNDS ?? 2) })
  .then(() => process.exit(0))
  .catch((e) => { console.error("V7 FAILED", e?.stack || e); process.exit(1); });
