import crypto from "crypto";
import { Database } from "../src/lib/db";
import { OwnerAgent } from "../src/lib/agents/owner";

const WORKER_ID = `worker-${crypto.randomBytes(3).toString("hex")}`;
const POLL_INTERVAL_MS = 3000;

let isRunning = true;

async function processNextJob(): Promise<boolean> {
  const job = await Database.claimNextJob(WORKER_ID);
  if (!job) return false;

  console.log(`\n[${WORKER_ID}] Claimed job ${job.id} for order ${job.orderId} (Attempt ${job.attempts}/${job.maxAttempts})`);

  const order = await Database.getOrderById(job.orderId);
  if (!order) {
    console.error(`[${WORKER_ID}] Order ${job.orderId} not found in database!`);
    await Database.failJob(job.id, job.orderId, "Order record missing");
    return true;
  }

  try {
    await Database.updateOrder(order.id, { status: "generating" });

    console.log(`[${WORKER_ID}] Starting Owner orchestration for "${order.topic}"...`);
    const deck = await OwnerAgent.orchestrate(order.options, (step, percent, details) => {
      console.log(`  [Order ${order.id.slice(0, 8)}] [${percent}%] ${step} ${details ? `(${details})` : ""}`);
    });

    await Database.completeJob(job.id, order.id, deck);
    console.log(`✓ [${WORKER_ID}] Job ${job.id} COMPLETED successfully. Deck ID: ${deck.id}`);
  } catch (err: any) {
    const errorMsg = err.message || "Unknown error during orchestration";
    console.error(`✗ [${WORKER_ID}] Job ${job.id} failed:`, errorMsg);

    // Check if refused by policy
    if (errorMsg.toLowerCase().includes("policy") || errorMsg.toLowerCase().includes("inappropriate")) {
      await Database.updateOrder(order.id, {
        status: "refund_due",
        errorMessage: "Content was flagged by content safety policy. Marked for manual refund.",
      });
      await Database.failJob(job.id, order.id, "Content safety violation - refund due");
    } else {
      await Database.failJob(job.id, order.id, errorMsg);
    }
  }

  return true;
}

export async function startWorker(runOnce = false) {
  console.log("=========================================");
  console.log(`  AI PRESENTATION BACKGROUND WORKER ACTIVE `);
  console.log(`  Worker ID: ${WORKER_ID}`);
  console.log(`  Mode: ${runOnce ? "Single Run" : "Continuous Polling"}`);
  console.log("=========================================\n");

  if (runOnce) {
    const processed = await processNextJob();
    console.log(processed ? "Processed 1 job." : "No jobs queued.");
    return;
  }

  while (isRunning) {
    try {
      const processed = await processNextJob();
      if (!processed) {
        // Sleep if no work
        await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
      }
    } catch (e) {
      console.error(`[${WORKER_ID}] Polling error:`, e);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

// If executed directly from CLI
if (require.main === module) {
  const runOnceArg = process.argv.includes("--once");
  startWorker(runOnceArg).catch((e) => {
    console.error("Worker fatal crash:", e);
    process.exit(1);
  });
}

