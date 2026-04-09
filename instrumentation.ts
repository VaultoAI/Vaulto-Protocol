/**
 * Next.js Instrumentation
 *
 * This file runs when the Next.js server starts.
 * Used for logging configuration status on startup.
 *
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  // Only run on server
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { logVaultoApiConfigStatus } = await import(
      "./lib/vaulto-api/config"
    );

    console.log("[Startup] Checking configuration...");
    logVaultoApiConfigStatus();
  }
}
