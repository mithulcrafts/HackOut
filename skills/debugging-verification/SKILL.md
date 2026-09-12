---
name: debugging-verification
description: Reproduce bugs, test changed HackOut behavior and verify final handoffs with evidence appropriate to the repository's actual tooling.
---

# Debugging, tests and completion

## Reproduce and diagnose

1. Capture the expected/actual behavior, input, environment, timestamps and seed. Reproduce with the smallest existing test or UI/API flow when possible.
2. Read relevant tests and trace the failing boundary. Test one hypothesis at a time; do not mask failures with defaults or disable validation to make a demo green.
3. If reproduction is unavailable, state why and use source evidence to narrow the fix. Do not call an inferred cause confirmed.
4. Make the smallest root-cause fix, add a meaningful regression test and repeat the original failing case. Avoid unrelated refactoring.

## Select actual checks

- Inspect `package.json`, test configuration and CI before choosing commands. At creation of this instruction system, none exist; application checks cannot run yet.
- The plan targets pnpm and Vitest. After scaffold, use configured scripts for lint/typecheck/test/build. For focused runs, use the installed runner's non-watch invocation, e.g. `pnpm exec vitest run <existing-test>` only when Vitest/configuration exists.
- Use project-aware typechecking; passing an isolated file to `tsc` is not a substitute for checking the repository's tsconfig and aliases.
- Run the smallest relevant set first. Add tests for meaningful behavior and bugs, then expand for affected integration boundaries, contract changes and phase gates. Do not repeatedly run unchanged suites after they pass.
- Test outcomes and invariants, not copied implementation expressions. Do not weaken assertions, skip failures or fabricate fixtures solely to obtain a pass.

## Project-specific evidence

- Domain changes: use deterministic fixtures and the invariants in [energy-domain](../energy-domain/SKILL.md).
- API/database changes: check invalid input, cross-user access, stale versions and retry/duplicate handling as relevant. Unit mocks do not prove RLS or database transactions work.
- UI changes: follow [mobile-ui](../mobile-ui/SKILL.md); a build is not evidence of touch, layout or navigation behavior.
- Dependency/configuration changes: run the actual install/build path affected. External services and deployment need separate evidence; local success does not prove remote success.
- Documentation/instruction-only changes: inspect every changed file, relative links, frontmatter, hierarchy, duplication, contradictions and `git diff --check`. No application tests or scaffold are required merely to validate prose.

## Definition of done

- Requested outcome satisfied; active phase and architecture preserved.
- Existing functionality preserved; reusable components/services extended where appropriate; no unnecessary duplicates.
- Diff and new files reviewed; no unrelated edits, secrets or unresolved conflict markers.
- Meaningful tests added/updated where needed; relevant checks passed and caused failures fixed.
- Appropriate lint/type/build/integration checks run; unavailable checks explicitly recorded with reason and practical impact.
- Documentation matches the changed behavior and distinguishes planned capabilities from implemented ones.
- Final response states changes, actual verification and remaining limitations; never substitute “should work” for evidence or claim skipped checks passed.
