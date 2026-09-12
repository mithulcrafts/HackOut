import assert from "node:assert/strict";

const base = process.env.SMOKE_BASE_URL ?? "http://localhost:3000";
let cookie = "";
let checks = 0;
async function call(path, body, expected = 200, method = body === undefined ? "GET" : "POST") {
  const response = await fetch(new URL(path, base), { method, headers: { cookie, ...(body === undefined ? {} : { "content-type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body), redirect: "manual", signal: AbortSignal.timeout(30000) });
  const setCookie = response.headers.get("set-cookie");
  if (setCookie?.includes("hackout_demo_session=")) cookie = setCookie.match(/hackout_demo_session=[^;]+/)[0];
  const text = await response.text();
  assert.equal(response.status, expected, `${method} ${path}: ${text.slice(0, 250)}`);
  checks++;
  return response.headers.get("content-type")?.includes("application/json") ? JSON.parse(text) : text;
}
async function reset() { return call("/api/consumer", { command: "reset" }); }
async function action(state, command, extra = {}) { return call("/api/consumer", { command, offerId: state.offer.id, version: state.offer.version, ...extra }); }

await call("/operator/overview?demo=1");
assert.ok(cookie, "Demo entry must establish a session");
await reset();
let state = await call("/api/consumer");
assert.equal(state.availableOffers.length, 3);
for (const choice of state.availableOffers) {
  state = await call(`/api/consumer?offerId=${choice.id}`);
  state = await action(state, "accept");
  const pending = await call("/api/rewards");
  assert.ok(pending.entries.some((entry) => entry.offer_id === choice.id && entry.state === "pending"));
  if (choice.name === "Water heater") {
    await call("/api/scenarios/playback", { activityId: "activity-water", outcome: "success" });
    state = await call(`/api/consumer?offerId=${choice.id}`);
  } else {
    state = await action(state, "simulate", { outcome: "success" });
    state = await action(state, "verify");
  }
  assert.equal(state.verification.status, "verified");
  state = await action(state, "verify");
}
let wallet = await call("/api/rewards");
assert.equal(wallet.entries.length, 3, "Retry must not duplicate rewards");
await call("/api/rewards", { rewardId: wallet.entries[0].id });
wallet = await call("/api/rewards");
assert.equal(wallet.entries[0].state, "redeemable");
const operator = await call("/api/scenarios");
assert.ok(operator.summary.verifiedKW > 0);
assert.equal(operator.scenario.rewardLedger.length, 3);
const forecast = await call("/api/forecast");
assert.deepEqual(forecast.balances, operator.balances);
const preview = await call("/api/scenarios/preview", { renewableMultiplier: 0.2, demandMultiplier: 1.4 });
assert.equal(preview.mutatedAcceptedData, false);
assert.notDeepEqual(preview.balances, operator.balances);
assert.deepEqual((await call("/api/scenarios")).scenario, operator.scenario, "What-if preview must not mutate commitments or evidence");
for (const path of ["/", "/consumer/today", "/consumer/activities", "/consumer/activities/activity-ev", "/consumer/offers", "/consumer/rewards", "/consumer/profile", "/operator/overview", "/operator/events", "/operator/flexibility", "/operator/verification", "/operator/rewards", "/operator/reports", "/operator/simulation", "/operator/settings"]) await call(path);

for (const outcome of ["partial", "late", "rebound", "missing"]) {
  state = await reset();
  state = await action(state, "accept");
  state = await action(state, "simulate", { outcome });
  state = await action(state, "verify");
  assert.notEqual(state.verification.status, "verified", `${outcome} must not be counted as full delivery`);
  wallet = await call("/api/rewards");
  assert.ok(wallet.entries.every((entry) => entry.state === "pending"));
  if (outcome === "missing") {
    assert.equal(state.verification.status, "pending");
    state = await action(state, "simulate", { outcome: "success" });
    state = await action(state, "verify");
    assert.equal(state.verification.status, "verified");
  }
}
state = await reset();
const originalVersion = state.offer.version;
state = await action(state, "modify", { startSlot: state.presentation.allowedStarts.at(-1) });
assert.equal(state.offer.decision, "pending");
await call("/api/consumer", { command: "accept", offerId: state.offer.id, version: originalVersion }, 409);
state = await action(state, "accept");
state = await action(state, "override");
assert.equal(state.offer.decision, "overridden");
await reset();
const created = await call("/api/activities", { type: "EV charging", name: "Smoke EV", earliestStart: "10:00", latestFinish: "17:00", durationHours: 1, interruptible: true }, 201);
let detail = await call(`/api/activities/${created.activity.id}`);
assert.equal(detail.activity.name, "Smoke EV");
await call(`/api/activities/${created.activity.id}`, { type: "EV charging", name: "Updated EV", earliestStart: "10:00", latestFinish: "18:00", durationHours: 1, interruptible: true, powerKW: 4 }, 200, "PATCH");
detail = await call(`/api/activities/${created.activity.id}`);
assert.equal(detail.activity.name, "Updated EV");
await call("/api/activities", { type: "EV charging", name: "Invalid", earliestStart: "16:00", latestFinish: "15:00", durationHours: 2, interruptible: true }, 400);
state = await reset();
state = await action(state, "skip");
assert.equal(state.offer.decision, "skipped");
assert.equal((await call("/api/scenarios")).summary.acceptedKW, 0);
assert.ok(state.notifications.some((entry) => !entry.read_at));
await call("/api/notifications", {});
assert.ok((await call("/api/consumer")).notifications.every((entry) => entry.read_at));
await reset();
const draft = await call("/api/events", { name: "Morning peak protection", objective: "protect", windowStart: 20, windowEnd: 24, requestedFlexibilityKW: 4, eligibleActivityTypes: ["ev"], rewardRatePerKWh: 1.5, budget: 20, offerExpiresAt: "2026-09-12T09:00:00+05:30" }, 201);
await call(`/api/events/${draft.event.id}/publish`, {});
state = await call("/api/consumer");
const protect = state.availableOffers.find((choice) => choice.id.includes(draft.event.id));
assert.ok(protect, "Protect event must offer an outside-peak shift");
state = await call(`/api/consumer?offerId=${protect.id}`);
assert.ok(state.offer.proposed_start >= 24 || state.offer.proposed_start + state.offer.duration_slots <= 20);
state = await action(state, "accept");
state = await action(state, "simulate", { outcome: "success" });
state = await action(state, "verify");
assert.equal(state.verification.status, "verified");
const report = await call(`/api/events/${draft.event.id}/report`);
assert.equal(report.funnel.verified, 1);
await call(`/api/events/${draft.event.id}/close`, {});
const originalCookie = cookie;
cookie = "";
await call("/consumer/today?demo=1");
assert.notEqual(cookie, originalCookie, "Browsers must receive isolated demo sessions");
assert.equal((await call("/api/rewards")).entries.length, 0, "A new session must not inherit another wallet");
cookie = originalCookie;
await reset();
console.log(`PASS: ${checks} HTTP checks; 3 activity journeys, shared operator verification, reward retries/redemption, failure recovery, navigation, edit and validation. Demo reset for manual testing.`);
