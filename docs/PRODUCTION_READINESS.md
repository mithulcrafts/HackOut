# Production readiness checklist

The hackathon workflow is complete. The following integrations are intentionally
provider-bound and must be enabled before production deployment:

1. **Settlement:** implement an approved DISCOM or payment-provider adapter that
   writes `settlement_transactions` with an idempotency key and verifies signed
   webhooks. The current ledger remains illustrative until this adapter is live.
2. **Durable operator state:** apply `20260913150000_operator_durable_state.sql`,
   migrate route handlers from the in-memory store to these tables, and run an
   RLS review with real operator accounts.
3. **Forecast validation:** load matched Gujarat plant history (timestamp,
   measured output, capacity and weather) into a validation job. Report MAE,
   RMSE, interval coverage and seasonal/site splits before displaying accuracy.
4. **Realtime:** enable Supabase Realtime for operator tables and replace the
   development reload callback with scoped programme channels.
5. **Security:** use production-only secrets, secure cookies, request rate limits,
   audit retention, webhook signature checks, and a formal RLS/access review.
6. **Notifications:** connect approved SMS/email/push providers with delivery
   receipts, opt-out handling and retry limits.

No item above should be represented as live until its provider credentials,
approval and operational owner are documented.
