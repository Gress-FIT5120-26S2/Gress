# API and Database Security Remediation Report

**Project:** KitchMemo  
**Remediation date:** 4 September 2026  
**Status:** Completed and deployed  
**Production release:** `main` commit `ab4064d`  
**Security implementation:** commit `2d86295`

## Executive Summary

KitchMemo completed a security hardening release covering three main vulnerability areas: missing API rate limiting, permissive CORS behaviour, and unsafe PostgreSQL function permissions or configuration. The changes were applied to both the test and production environments and were verified after deployment.

No mobile application rebuild was required because these remediations affected the Express API, Vercel configuration, and Supabase database only.

## 1. API Rate Limiting

**Original severity:** Medium  
**Issue:** Public API requests were not protected by an observable global rate limit. This increased exposure to automated abuse, request flooding, excessive third-party API usage, and brute-force attempts against sensitive routes.

**Remediation:**

- Added a global rate limit for all `/api` routes.
- Added stricter limits for device recovery, fridge joining, AI generation, and photo-recognition routes.
- Implemented shared, database-backed counters so limits remain effective across multiple serverless instances.
- Used hashed client identifiers so raw IP addresses and device identifiers are not stored in the rate-limit table.
- Standardised blocked responses as HTTP `429 Too Many Requests` with a `Retry-After` header and a machine-readable response body.
- Configured the API to fail safely with HTTP `503` if the shared limiter cannot be reached.

**Verification:** Both Preview and Production returned global rate-limit headers. Controlled invalid requests were accepted up to the route threshold and then returned `429` with a valid `Retry-After` value.

## 2. CORS Origin Restrictions

**Original severity:** Low  
**Issue:** The API previously allowed arbitrary browser origins through `Access-Control-Allow-Origin: *`. An unapproved website could therefore attempt browser-based calls to the API.

**Remediation:**

- Replaced wildcard CORS behaviour with an explicit origin allowlist.
- Restricted allowed HTTP methods and request headers.
- Requests containing an unapproved browser `Origin` are rejected with HTTP `403` and do not receive an `Access-Control-Allow-Origin` response header.
- Requests without an `Origin` remain supported for the native Android and iOS applications.
- Because KitchMemo currently has no web client, no browser origin is enabled by default.

**Verification:** Unapproved-origin preflight requests were rejected in both Preview and Production. Native-style requests without an `Origin` continued to reach the API successfully.

## 3. Supabase Database Function Hardening

**Original severities:** High and Low  
**Issues:**

- The privileged `SECURITY DEFINER` function `rls_auto_enable()` could be executable by `public`, `anon`, and ordinary `authenticated` roles.
- `get_restock_suggestions()` did not use an immutable, explicitly controlled `search_path`, creating avoidable object-resolution risk.

**Remediation:**

- Confirmed the expected function type and dependent event-trigger relationship before changing access.
- Revoked unnecessary execution permission on `rls_auto_enable()` from `public`, `anon`, and `authenticated` without deleting the function or its legitimate trigger dependency.
- Restricted the rate-limit and restock RPCs to the backend `service_role`.
- Set a fixed empty `search_path` for `get_restock_suggestions()` and retained schema-qualified database references.
- Revoked default public execution permission for future functions created by the database owner in the `public` schema.
- Recorded all database behaviour changes in new timestamped migrations so both environments remain reproducible and auditable.

**Verification:**

- Migrations were applied and tested in the development Supabase project before production.
- Supabase database lint completed without warnings.
- Backend service-role calls to the protected RPCs succeeded.
- Publishable/anonymous access to privileged rate-limit and restock RPCs was rejected.
- The restock suggestions flow continued to operate after the `search_path` change.

## Deployment and Validation Result

The final security release was deployed successfully to both environments:

- **Preview:** Connected to the development/test Supabase project and passed API security checks.
- **Production:** Connected to the production Supabase project and passed the same online checks.
- **Database:** Both Supabase projects contain the corresponding security migrations.
- **Mobile clients:** Existing Android and iOS builds remain compatible with the hardened API.

The three vulnerability areas are considered remediated based on code review, database permission checks, migration verification, and live endpoint testing.
