import { describe, expect, it } from "vitest";
import { isAcceptedOfferDecision } from "./evidence-upload";

describe("evidence offer decision normalization", () => {
  it("accepts both domain and presentation accepted values", () => {
    expect(isAcceptedOfferDecision("accept")).toBe(true);
    expect(isAcceptedOfferDecision("accepted")).toBe(true);
  });

  it("does not treat other decisions as accepted", () => {
    expect(isAcceptedOfferDecision("pending")).toBe(false);
    expect(isAcceptedOfferDecision("skip")).toBe(false);
    expect(isAcceptedOfferDecision("override")).toBe(false);
  });
});
