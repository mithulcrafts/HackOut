---
name: git-collaboration
description: Coordinate two-person HackOut development, inspect Git state, resolve conflicts and make scoped commits without overwriting existing work.
---

# Git and shared work

## Inspect and update safely

- Inspect `git status --short`, current branch, `git branch -vv`, remotes, relevant history and staged diff. This repository used `main` tracking `origin/main` when inspected; verify rather than hard-code it.
- Follow the user-selected branch. For a new implementation branch, default to `codex/<feature>` and use separate checkouts/worktrees for concurrent agents. Do not switch a shared working directory while another person edits it.
- Fetch the appropriate remote before integration when possible; distinguish a fresh fetch from local remote-tracking state. Network restrictions are a blocker to report, not permission to invent synchronization.
- Update/rebase only with a clean, understood working tree and a known base. Never auto-stash, discard or stage another person's changes. Rebase private feature commits; integrate shared history without rewriting it.

## Parallel implementation

- Read plan section 7. Freeze shared request/response types, fixtures and migration ownership before concurrent implementation.
- Notify the relevant owner through the established team handoff before changing shared contracts. This rule does not independently authorize messaging tools. If coordination is unavailable, work on unaffected files and report the dependency.
- Use agreed fixtures through the same contract while an API is unfinished; do not add an alternate endpoint, schema or business rule.
- Resolve the plan's broad-domain versus verification ownership overlap before editing those files. Do not reinterpret ownership differently in each branch.

## Resolve merge conflicts

1. Inspect the merge base, both sides, callers and tests; understand each change's intent.
2. Preserve compatible functionality from both sides. Never choose whole-file ours/theirs without analysis.
3. Reconcile schema, API and lockfile changes with the actual implementation; regenerate a lockfile using its package manager if necessary, rather than splicing it blindly.
4. Remove conflict markers, review the resulting diff and run relevant behavior tests plus appropriate build/type/lint checks. Update changed contracts and documentation.

## Commit and publish

- Commit/push only within current user authorization; earlier permission to push one document is not blanket permission for future files or deployments.
- Inspect staged paths, stage explicit files and review `git diff --cached` before committing. Preserve unrelated staged work; do not use `git add .` reflexively.
- Use a concise purpose-based message; existing history uses `docs: ...`. Do not change Git identity or introduce invented attribution.
- Do not force-push, reset shared history, delete branches or overwrite remote work as a shortcut.
- After an authorized push, verify the result and report commit/branch and any excluded files. If it fails, report local commit state separately from remote state.
