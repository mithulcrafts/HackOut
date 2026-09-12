# Agent Instructions

## Start here
- Inspect Git status, tracked/untracked files and applicable instructions before editing.
- Before implementing or pushing, follow `skills/git-collaboration/SKILL.md` remote-sync preflight; check GitHub for newer commits first.
- Read [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for product and architecture decisions.
- Read [skills/README.md](skills/README.md), then only the skills relevant to the task.
- Repository-local skills are opened through these links; do not assume `skills/` is automatically registered by every coding tool.

## Hierarchy and current state
- Follow explicit user instructions within system/developer constraints; these files do not grant external-action permission.
- The implementation plan is the product source of truth; skills define execution discipline.
- Existing code/configuration establishes actual behavior. If it diverges from the plan, report the mismatch and resolve it in scope; do not silently rewrite either.
- The repository now contains a Next.js/TypeScript scaffold, deterministic Teammate A domain engine, operator routes, APIs, Vitest tests and a pnpm lockfile. Supabase migrations/auth, consumer pages and verification/reward processing remain integration targets owned by the joint Phase 0/B track.
- Recheck the actual application state on future tasks; paths and scripts in the plan are targets until implemented.

## Product constraints
- Build only Smart Demand-Response & Load-Shifting System; forecasting supports it. Do not invent a project name.
- Follow the mobile-first Next.js/TypeScript + Supabase plan; keep scheduling, verification and rewards server-side.
- Label simulated readings, generation estimates and illustrative rewards; never invent partner access, real payments or forecast accuracy.
- Preserve accept/modify/skip/override and no penalties for unsuitable offers.

## Collaboration
- Follow the feature ownership in plan section 7; do not create duplicate implementations to avoid dependencies.
- Inspect shared types, fixtures, migrations, API contracts and UI primitives before editing; coordinate contract changes.
- Preserve uncommitted teammate/user work and use the Git skill before branch, merge, commit or push operations.

## Package manager and checks
- Package manager: pnpm. Inspect the actual manifest, lockfile and configs before selecting commands.
- Gates: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` (the current scaffold has equivalent npm scripts and a generated pnpm lockfile; prefer pnpm when available).
- Use existing file-scoped lint/tests first; use project typecheck for project-aware TypeScript validation.
- For documentation-only work, check links, hierarchy, accuracy, conflicts and diff; do not invent application test results.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
