# KitchMemo Freshness Date Contract

## Product decision

KitchMemo uses two independent concepts. They must never be collapsed into one ambiguous expiry field.

### `useByAt`

`useByAt` is a hard safety deadline copied from a package label or another explicitly verified source. It is not predicted by Luna.

- Before the deadline, the item may be included in use-first ordering, subject to normal safety caveats.
- Once server time is later than `useByAt`, the item is hard-expired.
- A hard-expired item must never be recommended for consumption.
- The UI should direct the user to discard it.
- Changing or clearing a verified `useByAt` is a write operation requiring explicit confirmation.

### `estimatedQualityUntil`

`estimatedQualityUntil` is KitchMemo’s automatically calculated best-quality window. Users do not type or edit it directly.

The deterministic calculation uses:

- Matched food preset.
- Stocking timestamp.
- Storage zone.
- Local Australian season derived from the device’s validated IANA timezone.
- An approved seasonal quality profile.
- A versioned modifier from supported visual-freshness evidence, if available.
- Opened timestamp or other future verified storage-state inputs, when supported.

The result is a quality estimate, not a package safety label and not a guarantee that food is safe. Passing it means “quality window passed”, not automatically “hard-expired”. KitchMemo does not proactively recommend food after this point; it should explain the uncertainty and defer to a verified package `useByAt` and reviewed food-safety guidance.

## Effective attention ordering

For reminders and use-first ranking, calculate:

```text
attentionAt = earliest non-null value of useByAt and estimatedQualityUntil
```

The response must preserve the reason:

- `use_by_deadline`
- `estimated_quality_window`
- `both_same_day`

Only `useByAt < serverNow` creates the hard-expired state. `estimatedQualityUntil < serverNow` creates the separate quality-overdue state.

## Seasonal model

Version 1 uses Australian meteorological seasons in the validated local timezone:

- Summer: December to February.
- Autumn: March to May.
- Winter: June to August.
- Spring: September to November.

Seasonal days belong to versioned reference profiles, not prompts and not model weights. The initial milk product example is:

| Season | Estimated quality days |
| --- | ---: |
| Summer | 5 |
| Autumn | 6 |
| Winter | 7 |
| Spring | 6 |

The autumn and spring values are an initial interpolation pending approved reference review. They must be tagged as product defaults rather than authoritative food-safety limits.

If there is no enabled profile for the matched food and storage zone, the system may use the existing static preset shelf-life value as a clearly labelled fallback. It must record which profile, fallback, model version, season, timezone, and inputs produced the estimate.

## Target persisted fields

The development migration preserves legacy `expires_at` until existing clients are migrated. The new unambiguous fields are:

- `use_by_at timestamptz null`
- `estimated_quality_until timestamptz null`
- `quality_profile_uid uuid null`
- `quality_estimate_version integer null`
- `quality_estimate_basis jsonb`

The reference profile should include food preset, storage zone, season, number of days, jurisdiction, source classification, review state, and version.

## Backward compatibility

Existing `expires_at` values are ambiguous because historical records may contain a user-entered package date or an editable generated estimate. They must not be mass-labelled as `useByAt`.

During migration:

1. Keep historical `expires_at` unchanged for old clients.
2. Mark legacy semantic origin as unknown.
3. Do not use an ambiguous legacy value as a verified hard safety deadline.
4. New clients read the separate fields.
5. After a compatibility period, deprecate `expires_at` only through a later migration and coordinated API release.

## AI boundary

Luna may explain the stored result and select read-only tools, but it does not invent seasonal days, calculate safety deadlines, or overwrite reference profiles. Express and PostgreSQL remain authoritative for timestamps, season selection, versioning, and hard-expired classification.
