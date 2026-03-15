/**
 * Next.js instrumentation hook — körs en gång vid serverstart.
 * Startar bakgrundsjobben (cron) i Node.js-runtimen.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("./lib/scheduler");
    startScheduler();
  }
}
