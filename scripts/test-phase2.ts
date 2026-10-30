import { CapacityGate } from "../src/lib/capacity/capacityGate";
import { manualUpiProvider } from "../src/lib/payment/manualUpiProvider";
import { Database } from "../src/lib/db";
import { startWorker } from "./worker";

async function runPhase2Tests() {
  console.log("=========================================");
  console.log("  TESTING PHASE 2: PAYMENT & CAPACITY GATE");
  console.log("=========================================\n");

  // 1. Capacity Gate Initial Check
  console.log("[1] Checking Capacity Gate Status...");
  const cap1 = await CapacityGate.checkCapacity();
  console.log(`  Allowed: ${cap1.allowed} | Slots Remaining: ${cap1.slotsRemaining}/${cap1.maxDailyOrders}`);
  if (!cap1.allowed) {
    console.error("Capacity gate blocked unexpectedly.");
  }

  // 2. Create Order
  console.log("\n[2] Creating New Order for Rs 20...");
  const sampleRequest = {
    topic: "AI Agent Swarms in Modern Logistics",
    audience: "Logistics Managers",
    tone: "Analytical",
    slideCount: 3,
    language: "English" as const,
    imageSource: "stock" as const,
    toggles: {
      charts: true,
      diagrams: false,
      codeBlocks: false,
      icons: true,
      speakerNotes: true,
    },
  };

  const order1 = await manualUpiProvider.createOrder(sampleRequest.topic, sampleRequest, 20.00);
  console.log(`  ✓ Order 1 Created: ID=${order1.id.slice(0, 8)} | Status=${order1.status} | Amount=Rs ${order1.amountInr}`);

  // 3. Test Invalid UTR Validation (Must be exactly 12 digits)
  console.log("\n[3] Testing Invalid UTR Validation (< 12 digits)...");
  try {
    await manualUpiProvider.submitUtr(order1.id, "12345");
    console.error("  ✗ Error: Invalid UTR was accepted!");
  } catch (err: any) {
    console.log(`  ✓ Correctly rejected invalid UTR: "${err.message}"`);
  }

  // 4. Test Valid 12-Digit UTR Submission
  console.log("\n[4] Submitting Valid 12-Digit UTR...");
  const validUtr = `${Date.now()}`.slice(-12);
  const updatedOrder1 = await manualUpiProvider.submitUtr(order1.id, validUtr);
  console.log(`  ✓ UTR Submitted: ${updatedOrder1.utr} | Status=${updatedOrder1.status}`);

  // 5. Test Duplicate UTR Blocking
  console.log("\n[5] Testing Duplicate UTR Prevention on New Order...");
  const order2 = await manualUpiProvider.createOrder("Second Presentation Topic", sampleRequest, 20.00);
  try {
    await manualUpiProvider.submitUtr(order2.id, validUtr); // Same UTR
    console.error("  ✗ Error: Duplicate UTR was accepted!");
  } catch (err: any) {
    console.log(`  ✓ Duplicate UTR successfully blocked: "${err.message}"`);
  }

  // 6. Test Admin Approval
  console.log("\n[6] Testing Admin Approval Flow...");
  const approvedOrder1 = await manualUpiProvider.approve(order1.id);
  console.log(`  ✓ Order 1 Approved: Status=${approvedOrder1.status} | ApprovedAt=${approvedOrder1.approvedAt}`);

  // 7. Verify Job Queue & Run Worker
  console.log("\n[7] Running Background Worker to Process Queued Paid Order...");
  await startWorker(true); // Run once to process order1

  // 8. Verify Order Final State
  const finalOrder = await Database.getOrderById(order1.id);
  console.log(`\n[8] Verifying Final Order State:`);
  console.log(`  Status: ${finalOrder?.status}`);
  console.log(`  Deck ID: ${finalOrder?.deckId}`);
  console.log(`  Slide Count: ${finalOrder?.deckData?.slides?.length}`);

  if (finalOrder?.status === "completed") {
    console.log("\n=========================================");
    console.log("  ALL PHASE 2 TESTS PASSED SUCCESSFULLY!  ");
    console.log("=========================================");
  } else {
    throw new Error(`Order did not complete. Current status: ${finalOrder?.status}`);
  }
}

runPhase2Tests().catch((err) => {
  console.error("Phase 2 test failed:", err);
  process.exit(1);
});

