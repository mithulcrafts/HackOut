import { describe, expect, it } from "vitest";
import { eventMutationStatus } from "./event-errors";

describe("event API error mapping", () => {
  it("distinguishes missing resources from lifecycle conflicts", () => {
    expect(eventMutationStatus(new Error("Event not found."))).toBe(404);
    expect(eventMutationStatus(new Error("Only draft events can be published."))).toBe(409);
    expect(eventMutationStatus(new Error("Only active events can be closed."), 409)).toBe(409);
  });

  it("returns a client-error fallback for invalid event terms", () => {
    expect(eventMutationStatus(new Error("Offer expiry must be after the scenario decision time."))).toBe(400);
    expect(eventMutationStatus("unexpected failure", 409)).toBe(409);
  });
});

