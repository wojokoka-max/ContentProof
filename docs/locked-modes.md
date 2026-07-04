# Locked Modes

Tekst and HTML modes are considered complete.

## What This Means

- Do not change Text mode behavior unless the task explicitly says to reopen Text mode.
- Do not change HTML mode behavior unless the task explicitly says to reopen HTML mode.
- Keep both contract tests wired into the full test suite.
- Treat failures in these contract tests as release blockers.

## Locked Contracts

- Text mode must keep analyzing the whole pasted article.
- Text mode must keep complete creator-facing SEO, FAQ and schema output.
- HTML mode must preserve detected head metadata for full documents.
- HTML mode must analyze fragments without requiring head metadata.
- HTML mode must always provide three ready FAQ items and include them in schema.
- Neither mode may leak placeholders, editorial instructions, raw HTML FAQ, or incomplete answers into creator-facing output.

## Allowed Work Without Reopening

- Fixes outside Text and HTML mode.
- Test-only changes that make the lock stronger.
- Documentation that clarifies the contract.

## Reopening Rule

If a future task requires changing Text or HTML behavior, first state that the mode is being reopened, explain why, and add or update the contract test before changing implementation.
