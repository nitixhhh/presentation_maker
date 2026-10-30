/** Runs once when the server boots: resume deck jobs that were queued/running before a restart. */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { bootJobs } = await import("./server/jobs/manager");
    bootJobs();
  }
}
