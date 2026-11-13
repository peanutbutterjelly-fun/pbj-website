# Git and PR rules

Read by every coding agent in this repo (Claude Code loads it through `CLAUDE.md`).

## Titles (commits and PRs)

- **Format:** `type(scope): short summary`, lowercase, no full stop. The summary after the colon is **5 words at most**.
  - `type` is one of `feat`, `fix`, `chore`, `docs`, `revert`.
    - `feat`: something new people can see or use.
    - `fix`: something that was broken now works.
    - `chore`: housekeeping (folders, tooling, CI, dependencies).
    - `docs`: notes and instructions only (`AGENTS.md`, `CLAUDE.md`, `PLAN.md`, READMEs).
    - `revert`: undoing an earlier change. GitHub's Revert button (`Revert "…"`) counts too.
  - `scope` is required but free-form: one short word for the area touched (`frontend`, `backend`, `hero`, `events`, `dashboard`, `film`, `ci`, `agents`, …).
  - Examples: `feat(hero): jelly j spins on scroll`, `fix(dashboard): coupon card on phones`, `chore(backend): fastapi starter`, `docs(agents): pr title conventions`.

## Commits

- **Title:** the format above.
- **Message: 2 lines at most** under the title. Leave it out if the title says it all.
- One change per commit. If the title needs "and", split it.

## Pull requests and merging

- **Always squash and merge** into `main` (`gh pr merge --squash`). No merge commits, no rebase merges.
- The PR title becomes the one commit on `main`, so it follows the title format above. Get it right before opening or merging.
- One PR = one change. If the summary needs "and", split it.
- Never push straight to `main` (the pre-push hook blocks it).

## PR description

`gh pr create --body` skips GitHub's template, so write these sections yourself. Short sentences, plain words (the owner isn't technical). Delete an optional section rather than writing "n/a".

```markdown
## Why
What's broken or missing, and for whom. One or two sentences.

## Source
Where this came from (owner request, bug report, part of PLAN.md, issue link).
For a fix, the root cause in one line.

## What changed
The change itself, plus anything a reviewer wouldn't guess from the diff.

## How it was verified
Builds and tests run, what was clicked through in the browser, at which sizes.

<!-- pbj-shots:start -->
## Before / after
<!-- website changes only: filled in by `cd frontend && npm run pr-shots` -->
<!-- pbj-shots:end -->

## Risk / rollback
<!-- optional: only for backend, data, deploy or payments changes -->
```

- **Website changes:** after opening or updating the PR, run `cd frontend && npm run pr-shots` (or `npm run pr-shots -- <number>`). It builds this branch and `main`, takes desktop and phone screenshots of both on this computer, saves them on the `pr-screenshots` branch and writes the table between the `pbj-shots` markers. There is no GitHub job for this. Look at the screenshots yourself before asking for review. Skip them only for a change where nothing looks different.
- Before asking for review, also check: no experiment files outside `frontend/lab/`, no heavy images or videos, colours stay in the Deep Jam palette, and motion respects "reduced motion".
