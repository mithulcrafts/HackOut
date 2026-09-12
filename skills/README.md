# Repository skill router

Start with [AGENTS.md](../AGENTS.md) and relevant sections of [IMPLEMENTATION_PLAN.md](../IMPLEMENTATION_PLAN.md). Load only applicable instructions below. Do not copy the entire skill library into each prompt.

| Task | Read | Owns these rules |
|---|---|---|
| Feature, refactor, scaffold or documentation change | [repository-workflow](repository-workflow/SKILL.md) | Discovery, reuse, planning, architecture, implementation and documentation synchronization |
| Branches, concurrent work, integration or publishing | [git-collaboration](git-collaboration/SKILL.md) | Safe updates, ownership, conflicts and focused commits |
| Bug, changed behavior or final handoff | [debugging-verification](debugging-verification/SKILL.md) | Reproduction, tests, validation and definition of done |
| Package, provider, configuration, auth, database or deployment change | [dependencies-security](dependencies-security/SKILL.md) | Compatibility, secrets, authorization, migrations and release checks |
| Consumer/operator screen or chart | [mobile-ui](mobile-ui/SKILL.md) | Existing component reuse, phone usability and visual verification |
| Forecast, schedule, meter, verification, rewards or simulation | [energy-domain](energy-domain/SKILL.md) | Domain boundaries, units, evidence and correctness checks |

## Use and maintenance

- For a small documentation edit, use repository-workflow and the documentation-only checks in debugging-verification. Do not load UI or energy skills unless their behavior is affected.
- For a feature, combine repository-workflow with its domain/UI skill and debugging-verification. Load git-collaboration when coordinating or changing Git state.
- Each folder contains a self-contained `SKILL.md` with name/description metadata. These are repository instructions, not proof of a global skill installation.
- In another coding tool, explicitly point its agent to root `AGENTS.md`; do not maintain a second copy of these rules in generated prompts. No CLAUDE/Cursor configuration currently exists to migrate.
- The application plan stays authoritative for product choices. Keep workflow details here; link rather than repeat them elsewhere.
- When scaffold/configuration is introduced, update the current-state note and command guidance in `AGENTS.md` in that same task.
