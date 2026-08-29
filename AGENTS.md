# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## KitchMemo code comments

For all non-template code written or substantially changed in this project, add concise comments only where the intent or data flow is not obvious. Use valid language-specific comment syntax and this bilingual format:

```ts
// Arthur: NarIyirm
// 中文：说明这段逻辑的目的或状态如何传递。
// EN: Explain the purpose or how state flows here.
```

Do not add comments to trivial syntax or repeat what the code already says.

## KitchMemo backend data context

Before changing Supabase schema, Express data routes, device bootstrap, fridge sharing, inventory, notifications, or achievements, read `docs/data-architecture/BACKEND_DATA_CONTEXT.md` completely. Treat the deployed migration in `supabase/migrations/` as the schema source of truth, and update the context document whenever the data contract changes.

## Supabase migration preservation rule

Every change to the Supabase database schema or database behaviour must be captured in a new, timestamped SQL migration under `supabase/migrations/` and committed to Git. This includes tables, columns, indexes, constraints, enum values, RLS policies, grants, triggers, functions/RPCs, views, storage policies, and seed-dependent reference data.

- Never edit, delete, rename, or rewrite a migration that has already been applied to any remote project. Create a new migration instead.
- Never treat Dashboard, Table Editor, or remote SQL Editor changes as complete work. If such a change was made, immediately generate or write an equivalent migration before continuing.
- Before applying a migration to production, apply and verify the same migration in the development/test project first.
- Keep `supabase/seed.sql` limited to reproducible non-user reference data. Never use it for production inventory, devices, invitations, or other user data.
- Do not run destructive remote reset commands against production. A migration file is the recoverable, reviewable record used to reproduce each environment.
