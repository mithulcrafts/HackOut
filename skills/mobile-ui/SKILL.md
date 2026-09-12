---
name: mobile-ui
description: Build or review mobile consumer/operator screens and charts using the HackOut plan's existing design system and accessible components.
---

# Mobile UI implementation

## Reuse and layout

- Read plan sections 5.13 and 10–12; inspect installed UI components, tokens, route layout and chart wrappers before adding a screen.
- Use existing shadcn/Tailwind/Lucide/Recharts patterns. Keep registry components in the established directory; do not duplicate primitives across `components` and `src/components`.
- Start at 390px, verify a narrower phone and desktop operator layout. Keep bottom navigation clear of safe areas, keyboard and primary actions. Use the plan's minimum tap-target size and visible labels.
- Make route files resolve to the listed public URLs; parenthesized Next.js groups do not create path segments.
- Keep screens focused on the next consumer action or operator decision. Do not add marketing pages, project names or unrelated decorative resources.

## State and data

- Keep calculations and reward decisions on the server/domain boundary. Present typed results; do not recreate business rules in chart transforms or optimistic UI.
- Show loading, empty, error and success states, plus offline/no-valid-window when relevant. Never show acceptance or verification as committed until the server confirms it.
- Use deterministic fixtures through the agreed contract while the backend is unfinished; visibly identify simulated data. Replace the adapter, not component semantics, at integration.
- Preserve user choices and render server errors as useful recovery actions. Support touch and keyboard rather than hover-only interactions.

## Visual consistency and checks

- Use the canonical semantic tokens. The plan currently conflicts on Absorb colors; reconcile that in the plan before implementing tokens, rather than allowing per-screen palettes.
- Reuse planned typography, responsive spacing and motion; respect reduced motion and focus. Do not treat the visual-direction label as a user-facing project name.
- Charts need units, time range, provenance, legends, touch-accessible values and a readable text/table alternative. Ensure responsive chart containers have usable height and do not cause page-wide overflow.
- Verify the actual rendered screen in a browser or available UI tool: navigation, sheets, long labels, loading/error states, keyboard focus, chart taps and safe-area positioning.
- Report browser/viewport tested. If UI execution is unavailable, distinguish source review from visual verification; do not claim screenshots or mobile checks that were not performed.
