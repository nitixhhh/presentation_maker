import os from "os";
import path from "path";

/** Root for server-side data: jobs/ (job records) and decks/ (deck working copies). */
export const DATA_ROOT = process.env.DECKCRAFT_DATA_DIR || path.join(os.tmpdir(), "deckcraft-data");
