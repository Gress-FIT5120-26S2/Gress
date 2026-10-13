# KitchMemo API Request Examples

These examples are documentation, not executed requests. Use them only against an authorised development/test environment with a disposable identity. Placeholders such as BATCH_UUID and DEVICE_CREDENTIAL must be replaced with authorised values. Do not place real credentials in this document, screenshots or shell history. Inspect current route validators and client types before writing a new integration.

## Authentication and bootstrap

Native requests carry Device-ID and Device-Credential. The credential is a 64-character hexadecimal secret generated and stored by the app; device ID alone is insufficient. No email/password bearer-login flow exists. The existing device middleware can authenticate/bootstrap first-time valid installation material through its database contract; do not manually claim an existing installation with invented credentials.

Public health: GET /api/health. Expected success: {"status":"ok","database":"connected"}.

Bootstrap: POST /api/devices/bootstrap with the installation headers. Inventory snapshot: GET /api/inventory with the same headers. Resolve the returned fridge and batch IDs; never select another household by submitting a fridge ID.

## Create a manual batch

POST /api/inventory/batches with JSON, after normal device authentication:

```json
{
  "name": "Test rice",
  "categoryCode": "staples",
  "storageZone": "pantry",
  "initialQuantity": 1,
  "unit": "kg",
  "purchasePrice": 2.5,
  "priceSource": "user",
  "deadlineType": "best_before",
  "expiresAt": null,
  "expiryWarningDays": null,
  "presetUid": null,
  "restockRule": null
}
```

This is a deliberately simple disposable stock example. Enter a real package date and packaging profile only after checking the item. Do not submit creator/actor/fridge ownership as trusted fields. A null date does not become a guessed safety deadline.

## Quantity update and conflict

PATCH /api/inventory/batches/BATCH_UUID/quantity:

```json
{"remainingQuantity": 0.75, "expectedVersion": 1}
```

Use the actual current version returned by the API. A decrease records consumption under the current transaction rules and can return a waste-learning opportunity. If HTTP 409 occurs, reread and obtain a new user decision; do not silently repeat the old decrement with a newer version. Check inventoryApi.ts and the current route for the returned object and optional opportunity fields.

## Shopping list

POST /api/cart:

```json
{"name":"Test rice","quantity":1,"unit":"kg","source":"manual"}
```

PATCH /api/cart/ITEM_UUID/toggle:

```json
{"is_checked":true}
```

Cart fields retain their current snake_case contract. Buying a cart item and creating its stock batch are separate workflow outcomes; use the checkout implementation when integrating inventory stocking.

## Assistant proposal confirmation

POST /api/assistant/messages:

```json
{"message":"Which recorded items need attention first?","language":"en"}
```

An existing conversation can include its authorised conversationUid. Covered external-AI calls require valid consent first. If a response proposes an action, POST /api/assistant/actions/ACTION_UUID/confirm with {"confirm":true}, or use the cancel route. Only confirm a returned authorised proposal after an actual user's decision. Do not construct an action ID from another device's history.

## Formal learning answer

Obtain catalogue/state and start an attempt using current allowed stage/mode codes from learningAssessment.js and the published catalogue. Do not invent stage IDs. After receiving the current question, POST /api/learning/attempts/ATTEMPT_UUID/answers:

```json
{
  "requestKey":"example_answer_001",
  "questionUid":"QUESTION_UUID",
  "optionId":"OPTION_CODE"
}
```

Use the returned question UUID and offered option code. Preserve the same key and original payload when a response is lost; a first answer is immutable. Subsequent next/finish/abandon operations use {"requestKey":"unique_operation_key"}. Never submit score, passed or learner ownership fields. The exact current bounds and code allowlists are in routes/learning.js.

## External AI permission and erasure

GET /api/privacy/ai-consent reads the current installation choice. PUT /api/privacy/ai-consent accepts exactly:

```json
{"allowed":true,"version":"2026-10-12"}
```

Use false to withdraw. A later consent-version change requires reading the current version rather than permanently hardcoding this example. No deviceId field is accepted.

DELETE /api/privacy/device-data requires exactly {"confirm":"DELETE"}. This is an irreversible identity/data operation, not a normal smoke-test cleanup command. Use only after a real deletion decision or explicit disposable-test agreement, and inspect the deleted-state behaviour and other-members' original records. The administrative asset retry uses a separate cron secret and is never a device API integration.

## Error handling

Read stable module error codes. Preserve retry time for 429, treat version/state conflicts as a new decision, and never expose raw SQL/provider secrets in a user error. On identity_erased stop the old identity's requests. On AI-consent-required use the explicit permission flow or manual fallback. A health success does not establish that optional providers or all RPCs work.

Verified source basis: server/src/index.js; routes/inventory.js, cart.js, assistant.js, learning.js and privacy.js; src/services/inventoryApi.ts and learningGateway.ts. The examples are supplementary; route validators and deployed migration behaviour remain authoritative.
