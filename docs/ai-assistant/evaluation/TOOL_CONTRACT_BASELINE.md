# Spoonie Read Only Tool Contract Baseline

## Security model

All tools execute in Express after `requireDevice` has authenticated the device and resolved `request.fridgeUid`. The client and Luna never provide `fridgeUid`. Every tool validates its arguments with JSON Schema, caps returned rows, and returns only fields needed for the user question.

The model can propose actions but has no mutation tools. After explicit user confirmation, Express maps a validated pending action to an existing authenticated inventory or cart endpoint and revalidates current state and versions.

## Proposed tools

### `get_inventory_summary`

Use for broad current-inventory questions and empty-state checks.

Returns counts and compact grouped totals for active batches in the current fridge. It must preserve units and must not combine incompatible units.

### `get_inventory_items`

Use for filtered item lists, exact quantities, locations, separate use-by and quality-estimate dates, and safe ownership questions.

Supported filters should include normalized name, storage zone, category, owner scope, and bounded result count. Express may return `ownerLabel` and `creatorLabel`, but never real device IDs.

### `get_use_first_items`

Returns dated, active batches ordered by the earliest applicable `useByAt` or `estimatedQualityUntil`. Hard-expired use-by batches and quality-overdue batches are excluded from consumption-oriented recommendations in server logic regardless of model arguments.

### `get_expiring_items`

Returns active batches whose next attention timestamp falls in a validated future time window. Each result identifies whether the reason is a hard use-by deadline or a system quality window. Server time is authoritative; timezone handling must be explicit.

### `get_expired_items`

Returns active batches whose verified `useByAt` has passed. Every result is marked hard-expired, must-discard, and ineligible for consumption recommendations. A passed quality estimate alone is not returned as hard-expired.

### `get_missing_information`

Returns active batches for which the system cannot calculate a quality estimate, or other supported editable information is absent. Missing optional `useByAt` is reported accurately but is not automatically an error.

### `get_restock_suggestions`

Reuses the existing `get_restock_suggestions` database logic. It must group by food identity and unit, trigger at `current <= minimum`, and expose current, minimum, target, and suggested-add quantities.

### `get_batch_details`

Returns one batch only after verifying that it belongs to the current authenticated fridge. It returns a safe label for creator and owner, the current version, and no internal device identifier.

### `get_consumption_history`

Returns bounded aggregates from inventory events. Required arguments include a validated date window and scope of `personal` or `shared`.

- `personal` uses events attributable to the current device user and labels the result as a personal trend.
- `shared` aggregates only the current shared fridge and labels the result as a household or shared trend.
- Stock events and consumption events remain separate.
- Predictions require a documented minimum evidence threshold.

The initial database read model is `get_assistant_consumption_history`. Its maximum window is 366 days, and its first conservative evidence flag requires at least three stock events spanning at least 14 days. Product evaluation may tighten this threshold before predictive wording is enabled.

### `get_cart_items`

Returns current-fridge shopping-list items for duplicate detection and explanations. It exposes safe owner labels only and never changes the cart.

### `search_food_knowledge`

Runs hybrid RAG retrieval over enabled, reviewed knowledge. High-risk food-safety answers require authoritative Australian sources and validated citations from the current retrieval set.

## Proposed pending actions

These are structured response objects, not model tools:

- `prepare_cart_item`
- `archive_batch`
- `adjust_quantity`
- `mark_consumed`
- `edit_expiry`
- `set_restock_rule`

Every pending action includes a server-generated action ID, target display summary, validated arguments, expiry time, and the inventory or batch version used to prepare it. Confirmation must refer to one unexpired pending action. Execution rechecks fridge access and current version.

## Deliberately absent tools

- No arbitrary SQL tool.
- No tool accepting a model-supplied fridge ID or device ID.
- No recipe search or generation tool in version 1.
- No direct add, delete, edit, consume, reminder, or cart mutation tool exposed to Luna.
- No secret, credential, invitation, or recovery-code lookup tool.
