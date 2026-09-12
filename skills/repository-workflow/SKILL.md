---
name: repository-workflow
description: Inspect, plan and implement focused changes in this HackOut repository while reusing existing code and keeping its implementation plan accurate.
---

# Repository understanding and implementation

## Discover before editing

1. Read root instructions and relevant sections of [the implementation plan](../../IMPLEMENTATION_PLAN.md). Identify the active phase and observable acceptance criteria.
2. Inspect `git status --short`, `git diff`, `git diff --cached` and relevant history. Inventory with `rg --files --hidden -g '!.git/**' -g '!node_modules/**' -g '!.next/**'`. Inspect nested agent instructions before entering a directory.
3. Read relevant manifests, lockfiles, aliases, scripts, CI, tests, migrations and deployment config if present. Do not print secret files. Do not treat absent files as existing services.
4. Follow the relevant call chain: screen → API → domain function → persistence/provider → tests. Read callers before changing a signature.

## Search and reuse

- Before creating any component, hook, function, helper, API, service or config, search its behavior, existing names and imports with `rg -n`. Record the useful matches or the fact that none exists in the working plan.
- Reuse or extend the existing implementation whenever it satisfies the requirement. Never create a parallel helper or provider merely because its name differs from the proposed name.
- Distinguish similar-looking code with different semantics. Consolidate only when duplication is in scope and callers can be preserved; do not launch repository-wide cleanup during a narrow fix.
- Planned shared types/fixtures, domain modules and chart components are reuse targets, not claims that files exist today. Locate the actual paths first.

## Execute a focused change

- For non-trivial work, state a short plan: outcome, affected files, reuse decision, contract changes and verification. Routine reversible edits need no artificial approval stage.
- Implement the smallest complete slice for the active phase. Use focused functions, meaningful names, typed boundaries and existing constants/configuration; avoid speculative abstractions and unrelated formatting.
- Keep domain calculations independent of UI/providers. Do not build a second scheduler or verification rule inside a component.
- Preserve existing behavior unless the request changes it. If a requested approach conflicts with architecture, explain the concrete issue and reconcile it with user intent; never silently change the requirement.
- Match installed library APIs, not remembered examples. Do not bypass missing functionality with hard-coded success, silent errors, unsafe casts or TODO placeholders presented as completion.
- Keep context focused: reuse inspected contracts and decisions, revisit when edits invalidate them, and record temporary limitations in the relevant existing document.

## Documentation and final review

- Review `git diff` and untracked additions; use [debugging-verification](../debugging-verification/SKILL.md) to test, fix and finish.
- Update the implementation plan when approved product/API/schema/architecture decisions change. Once setup docs exist, update them when environment variables or commands change. Keep actual behavior and future targets explicitly separate.
- Do not add a new report for every feature. Update the closest existing document and callers/examples in the same task.

## Known pre-scaffold ambiguities

Before implementing an affected area, resolve the following in the plan and shared contract, rather than making separate teammate assumptions. Unrelated work can proceed.

- Section 7 assigns all `src/domain` to A but assigns verification/rewards to B: agree on concrete subdirectory ownership first.
- Sections 5.13 and 10 use different Absorb colors: select one semantic token mapping before visual work.
- Activity statuses do not include `partial`, although verification outcomes do: distinguish these fields in the schema.
- Route groups such as `(consumer)` do not themselves add a `/consumer` URL segment: ensure file paths match the listed public routes.
- Synthetic weather removes a weather dependency; it does not make Supabase Auth/database offline. Specify and test the actual offline fallback before claiming it works offline.
