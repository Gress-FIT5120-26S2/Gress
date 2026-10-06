# Learning Room v1 — source-checked draft

This directory contains authored content, not a deployed learning API or seeded database. Independent editorial review remains **pending**. See `docs/learning-room/CONTENT_CONTRACT.md` and `CONTENT_REVIEW.md`.

`question-bank.json` and `review.json` are server-only. Never import this directory into App.tsx, src/, assets/, or a public static bundle. Future API handlers must use explicit projections; questions are returned one at a time and answers only after the first recorded submission.

Run from the repository root:

```sh
node server/scripts/validate-learning-content.js
node --test server/test/learningContent.test.js
node server/scripts/validate-learning-content.js --release
```

The release command currently fails intentionally on pending independent review. Tests use in-memory approval fixtures only and do not approve real content.

After reviewing a draft edit, refresh its manifest explicitly with `node server/scripts/validate-learning-content.js --write-manifest`. Published versions cannot use this mode. A published version is immutable; subsequent edits require a new content version and preservation of old attempt snapshots. Database publication belongs to P3 and requires a new migration tested in development first.
