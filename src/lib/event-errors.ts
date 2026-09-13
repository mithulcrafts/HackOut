/**
 * Map deterministic event-domain failures to an HTTP response class.
 *
 * A missing event is a resource lookup failure, an attempt to repeat or
 * advance a lifecycle transition is a conflict, and malformed event terms
 * are client input errors. Keeping this mapping outside the domain keeps the
 * calculation layer independent of Next.js while making route behaviour
 * predictable for the UI and API clients.
 */
export function eventMutationStatus(error: unknown, fallback: 400 | 409 = 400): 400 | 404 | 409 {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (message === "Event not found.") return 404;
  if (message === "Only draft events can be published." || message === "Only active events can be closed.") return 409;
  return fallback;
}

