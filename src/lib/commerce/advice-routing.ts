// Deterministic orchestration; callbacks are durable Workflow steps in production.
export async function cursorFirst<T>(operations: {
  start: () => Promise<T | null>;
  poll: (ticket: T) => Promise<boolean>;
  pause: () => Promise<void>;
  close: (ticket: T) => Promise<void>;
  fallback: () => Promise<void>;
}) {
  let ticket: T | null = null;
  let complete = false;
  try {
    ticket = await operations.start();
    if (ticket)
      for (let poll = 0; poll < 30; poll++) {
        complete = await operations.poll(ticket);
        if (complete) break;
        if (poll < 29) await operations.pause();
      }
  } catch {
    // Provider errors and invalid output both select fallback. Never log prompts.
  } finally {
    if (ticket) {
      try {
        await operations.close(ticket);
      } catch {
        // Cleanup outages must not prevent delivery or trigger a second provider.
      }
    }
  }
  if (!complete) await operations.fallback();
}
