# KitchMemo Technical Reference Inventory

Generated from the inspected checkout on 12 October 2026. This inventory is a navigation aid, not an OpenAPI schema or a fresh remote audit.

## Ordered migration files

| Sequence | Migration file | SHA-256 |
| --- | --- | --- |
| 1 | 20260829000000_initial_kitchmemo_schema.sql | f022e7f21b364847a2f3ae722f27890ceddac60b3b58a6cfc536cb9b2d0d4d0f |
| 2 | 20260830000000_create_inventory_batch_rpc.sql | 8c43513f9c863f55eb2b4a23161cb76495b1ea6da7772ba86109e3b96b8fece2 |
| 3 | 20260830005000_restock_and_cart.sql | ac94cdc45b119bda0abafbe1ac872eca902e18f3a42fd46e0927f4ad5da9948d |
| 4 | 20260830010000_inventory_detail_mutations.sql | 7a6510e7760d1c1615dab609529a2513e0963cd28f2ae171603d6f3de15dbd2b |
| 5 | 20260830020000_fix_inventory_lifecycle_enum_cast.sql | 3c8c4f7346e0d227e790e9cc74a008e2d2128db320ee1f05840866bcaedc4511 |
| 6 | 20260830200000_sync_fridge_notifications.sql | 729d2dba8c959cc230350f940c65929ca724cf736582b888b3753363372fac88 |
| 7 | 20260831010000_upsert_photo_recognition_food_presets.sql | 576ce5f20dbbf7968c08b848bc3155639c4e58e96657363c3cba525ee609299f |
| 8 | 20260831020000_device_owned_shared_fridges.sql | 6a6a736b18ced7b6ce068f9b2d7d55d9ac14896e4522f4c94617fce3f28a27a9 |
| 9 | 20260831030000_manage_shared_fridges.sql | 23811e9ecdcd84e98b9613de2d43d7af20aa7dc8c4eb973a4e385e0b82b7fb6f |
| 10 | 20260901000000_fridge_sync_versions.sql | f5d97876744f7baca8399d3eb7ef560eed98dc76027dd343be391388f65b5ba8 |
| 11 | 20260901010000_fridge_sync_broadcast.sql | dd1d0c10078fd15e87d9373ecd07d40c228c2648fb5d83fc6a5e61d41fcb39ec |
| 12 | 20260901020000_shared_invite_join_errors.sql | 133aeaacd2e99efd22c3e93a4472d665d190cdba3c77e495addcf7dd6b819a0d |
| 13 | 20260902000000_ai_food_presets_and_icons.sql | ba388429ac8096671da5e9ada607b4f1fffc5a103ff3780332f1d0ffcc6c6020 |
| 14 | 20260902010000_device_profiles.sql | bcc5e4cf9db2001a68f8a501da39512a346629caf946b31d591920b16a57c8fc |
| 15 | 20260902020000_notification_preferences.sql | e4f333dbad367d7b4663385f9fde8a45e7f21d13f5b7bfea694b92bf4a55ad16 |
| 16 | 20260902030000_add_shared_notification_type.sql | c300f972022c5af4a635a104ec4a8bdaccd3abc373ea688aaa00220f56d242a4 |
| 17 | 20260902031000_notification_delivery.sql | b386325940c1058e53c49aee66a3759fbcd756a43012f091939d0330fa8ddcd1 |
| 18 | 20260903010000_api_security_hardening.sql | b66898e948f6638d076fc246b08cdea7db5f9b6045c28e89e230a03a4f29ed88 |
| 19 | 20260904010000_fix_api_rate_limit_timestamp.sql | fe34210bcddc974fa3ef0eca2e83f7e813bbd3ef964316f29edd509e24fcf858 |
| 20 | 20260904020000_inventory_expiry_warning_days.sql | 77512203de739722ac88a5c4bf7a3426f93044aa75da2c641ec90ec69f4ee704 |
| 21 | 20260907010000_inventory_input_guardrails.sql | cdd9884b409144a55fabacbcef11de399cdeb15de359e02bdc5842bde102f14b |
| 22 | 20260908010000_unit_aware_inventory_quantity_limits.sql | 940a72a6f74b864efc0eb53ac6e3c0c3c4db9590ed2f278396c6c2957030b283 |
| 23 | 20260908020000_custom_category_ai_icons.sql | dbb26af7f1647e549791918db53ca4c1b1d7654194d05a329baf6ef94d4e01b1 |
| 24 | 20260909010000_assistant_freshness_foundation.sql | 72b336d8f94bf9739cd918817d884e7146c25cda94e13b9f5d9d7f137959635b |
| 25 | 20260909020000_assistant_history_read_model.sql | 75240704c4bc100d20cc263c538eb80598c00b85631dbbd47a28146adfc6d440 |
| 26 | 20260909030000_assistant_rag_foundation.sql | 0335e4df6b7a9c42dc8c51b1f2b1a11032196e77a1520e14f06d66674082caf5 |
| 27 | 20260909040000_assistant_conversation_audit.sql | 97b9f3072bbee5a6b0e74bf31057dba5fe6bf6f489af1c7f944749796143672c |
| 28 | 20260910010000_fix_assistant_vector_operator.sql | 0fcbfdeb9660f0e017f72a70da945ceb6801f0e7a998088002873684b95267cb |
| 29 | 20260911010000_confirm_assistant_pending_actions.sql | 7b190d08de6ba708856c785f6506698572eeb784f9eadac47a05b163b3be7423 |
| 30 | 20260911020000_harden_assistant_action_confirmation.sql | c7ac108235cef791d472393772507d827d9ddd934091e3da318f58262fcd22da |
| 31 | 20260911030000_link_assistant_actions_to_messages.sql | 943d1f28d1f7933c7370a506aadd1b76efca29d86054b09dcced56b7e7cadad3 |
| 32 | 20260911040000_reconcile_pre_assistant_schema.sql | ad82b8d7389cf2bbfd77e55fd9122a76a5ae233b851950abd1bed7f9082059a8 |
| 33 | 20260912010000_inventory_outcome_accounting.sql | f9889d2fd8d2ff7b9617d6da3f5007c09ed3508f72b98a1e1d1a48b77e5bc613 |
| 34 | 20260912020000_achievement_dashboard.sql | f63f8b288f4f79418ed181f8d631f47c67d32f7469cc81f8815cdeb3f20e301a |
| 35 | 20260913010000_achievement_badge_progress.sql | a4978f1fa879960feb88801727c5a4a56fff76777a1a48db2fccd149435a7c55 |
| 36 | 20260913160000_fridge_daily_weekly_quests.sql | 4aa496d660da8c1451543eb851e98a3d874794f92f499ee8c0d1651d42060086 |
| 37 | 20260913170000_assistant_inventory_outcomes.sql | 0a1d25456fd87aa8b6fb472adc6f58d873a43ca503c06268ec5c6dd66b4fc4a2 |
| 38 | 20260913180000_expand_quest_library_and_slots.sql | a7007b1cd88ac5850ec10fd4393cd675fcc10a171078aae86e0f872986af1f9d |
| 39 | 20260914010000_shopping_cart_input_guardrails.sql | 4a5395cd3a532f3aa619c7cf1c9b9a9ba261acec7028bd1eeb4b7f5712e14ed5 |
| 40 | 20260922010000_fix_shared_join_assistant_scope.sql | 59a8e02bf8f94f86c35c63b40545b8fbcb6090710caae429917589c830a5753a |
| 41 | 20260923120000_reserve_weekly_quest_rerolls.sql | b9d0229e1b545718b2f86bf729201c28b060c864dc69249397f6df5174c5c0e5 |
| 42 | 20260923121000_clean_weekly_quest_slot_reconciliation.sql | 3723d99eebf9e0bc85f4af79016fb8d2d24a17f75df9e0e2da302d94436e093b |
| 43 | 20260924010000_achievement_stage_report.sql | 02a8a44623f1ef59dc2733d69717be1cfdb56015d83199c7fe2b1abab0d21e45 |
| 44 | 20261002010000_waste_sorting_learning.sql | 3cbc862e97a5a542cf214505be524c47d8eeae74837e4cca118881be00b19918 |
| 45 | 20261003010000_skip_sync_for_deleted_fridges.sql | 79cb0c535e8cba422a0369822f685ca1b3926bf767aedbc55610bb4486664065 |
| 46 | 20261003020000_one_sorting_attempt_per_event.sql | 026aec866840229322f5bd07c944634c7200acd513ece9fe60328b01ff0246de |
| 47 | 20261004010000_inventory_waste_profiles.sql | 787ecc6801245a8363a2f0322ee87cf9f3ec287c053665a8f9d2e91f21d50b31 |
| 48 | 20261005010000_learning_room_assessment.sql | fdd2ea09ed3d320cf38f7c75571d8e39d2b3b414ca4e19f6d49cf50c34caa9e4 |
| 49 | 20261005011000_learning_room_draft.sql | e34b7aa8658f202ba56d4876437d35157efc12fa9e7cdcc92ed964953aa5cc54 |
| 50 | 20261008010000_learning_tutor_foundation.sql | 235b66b11e862749e960bdee54c49fa677d02de4254c5d6d343dd636f706265d |
| 51 | 20261008011000_learning_tutor_draft.sql | 329e8b9ad4020b8b5155b49c003379a6d821e89c63a7d24b7692ec1ff7323087 |
| 52 | 20261008012000_learning_tutor_review_help.sql | be50724f05d12568d92deba1dc0b73f7652e9b3b804202f897f9b2aba7557e58 |
| 53 | 20261008013000_fix_learning_tutor_support.sql | 9a152b01af14ffc3efe2ea392b905c0f4c8e40309059f2cef0c1f9b2b31302df |
| 54 | 20261008014000_learning_tutor_evidence_v2.sql | 711b89afc5d8303d0bc9f54670f2ab3300c49457c9114a9a1be80b94518350cf |
| 55 | 20261008015000_learning_tutor_versioned_context.sql | f05b0c0413d10234006a3c6b56a29faa9c385b426a9d18e3d604deffc36911e2 |
| 56 | 20261008016000_fix_learning_tutor_credential_alias.sql | bc3b70b571be06bdb69115cfa2259fb2e1d2864e01bcda96125face771d8e335 |
| 57 | 20261012050000_publish_owner_reviewed_learning.sql | 0707b2e60a03421fb83488276a18b685aaf7536505937af6f39e6a1f1068065d |
| 58 | 20261012100000_app_store_privacy_and_erasure.sql | 756b1a151b02c945f0a174d10e6f71f51f348bf05b0e9f0781e9977946e9bb5c |

Total: 58 migrations. Latest: 20261012100000_app_store_privacy_and_erasure.sql.

## Statically detected table declarations

achievement_levels, achievements, api_rate_limit_buckets, assistant_conversations, assistant_feedback, assistant_knowledge_chunks, assistant_knowledge_documents, assistant_knowledge_sources, assistant_messages, assistant_pending_actions, assistant_request_audit, device_credentials, device_identity_links, device_privacy_choices, device_profiles, device_push_tokens, device_recovery_credentials, devices, erased_device_fingerprints, erasure_asset_queue, food_categories, food_presets, food_quality_profiles, fridge_achievements, fridge_invites, fridge_members, fridge_quest_assignments, fridge_sync_versions, fridge_xp_events, fridges, inventory_batches, inventory_events, learning_activity_progress, learning_attempt_requests, learning_content_versions, learning_learners, learning_quiz_answers, learning_quiz_attempts, learning_stage_progress, learning_tutor_conversations, learning_tutor_interventions, learning_tutor_manifests, learning_tutor_messages, learning_tutor_preferences, learning_tutor_requests, notification_deliveries, notification_reads, notifications, product_waste_suggestions, quest_definitions, restock_rules, shopping_cart_items, waste_material_assets, waste_sorting_attempts

Table declarations are derived from SQL text; consult deployed migrations for alterations, permissions and exact final columns.

## HTTP route inventory

Business routes are mounted under /api unless a full path is shown. Most require trusted device credentials; recovery, public pages and the cron route have separate boundaries. Payload definitions remain in route validators, client API types and module contracts.

| Method | Route | Source |
| --- | --- | --- |
| GET | `/` | `server/src/routes/publicPages.js` |
| GET | `/api/achievements` | `server/src/routes/achievements.js` |
| POST | `/api/achievements/quests/reroll` | `server/src/routes/achievements.js` |
| GET | `/api/achievements/report` | `server/src/routes/achievements.js` |
| POST | `/api/assistant/actions/:actionUid/cancel` | `server/src/routes/assistant.js` |
| POST | `/api/assistant/actions/:actionUid/confirm` | `server/src/routes/assistant.js` |
| GET | `/api/assistant/conversations` | `server/src/routes/assistant.js` |
| GET | `/api/assistant/conversations/:conversationUid` | `server/src/routes/assistant.js` |
| POST | `/api/assistant/messages` | `server/src/routes/assistant.js` |
| POST | `/api/assistant/messages/:messageUid/feedback` | `server/src/routes/assistant.js` |
| GET | `/api/barcode-products/:barcode` | `server/src/routes/barcodeProducts.js` |
| GET | `/api/cart` | `server/src/routes/cart.js` |
| POST | `/api/cart` | `server/src/routes/cart.js` |
| DELETE | `/api/cart/:id` | `server/src/routes/cart.js` |
| PATCH | `/api/cart/:id` | `server/src/routes/cart.js` |
| PATCH | `/api/cart/:id/quantity` | `server/src/routes/cart.js` |
| PATCH | `/api/cart/:id/toggle` | `server/src/routes/cart.js` |
| POST | `/api/devices/bootstrap` | `server/src/routes/inventory.js` |
| POST | `/api/devices/recover` | `server/src/index.js` |
| POST | `/api/devices/recovery-code` | `server/src/routes/sharing.js` |
| POST | `/api/food-presets/generate` | `server/src/routes/inventory.js` |
| GET | `/api/food-presets/suggestion` | `server/src/routes/inventory.js` |
| GET | `/api/fridges/context` | `server/src/routes/sharing.js` |
| PATCH | `/api/fridges/current` | `server/src/routes/sharing.js` |
| POST | `/api/fridges/invites` | `server/src/routes/sharing.js` |
| POST | `/api/fridges/join` | `server/src/routes/sharing.js` |
| POST | `/api/fridges/leave` | `server/src/routes/sharing.js` |
| POST | `/api/fridges/share` | `server/src/routes/sharing.js` |
| GET | `/api/health` | `server/src/index.js` |
| GET | `/api/internal/erasure-assets` | `server/src/routes/erasureCleanup.js` |
| GET | `/api/inventory` | `server/src/routes/inventory.js` |
| POST | `/api/inventory/batches` | `server/src/routes/inventory.js` |
| DELETE | `/api/inventory/batches/:batchUid` | `server/src/routes/inventory.js` |
| GET | `/api/inventory/batches/:batchUid` | `server/src/routes/inventory.js` |
| PATCH | `/api/inventory/batches/:batchUid` | `server/src/routes/inventory.js` |
| PATCH | `/api/inventory/batches/:batchUid/quantity` | `server/src/routes/inventory.js` |
| POST | `/api/inventory/batches/:batchUid/resolve` | `server/src/routes/inventory.js` |
| PUT | `/api/inventory/batches/:batchUid/restock-rule` | `server/src/routes/inventory.js` |
| POST | `/api/inventory/categories` | `server/src/routes/inventory.js` |
| GET | `/api/learning/activities/:activityCode` | `server/src/routes/learning.js` |
| PUT | `/api/learning/activities/:activityCode/completion` | `server/src/routes/learning.js` |
| POST | `/api/learning/attempts` | `server/src/routes/learning.js` |
| GET | `/api/learning/attempts/:attemptUid` | `server/src/routes/learning.js` |
| POST | `/api/learning/attempts/:attemptUid/abandon` | `server/src/routes/learning.js` |
| POST | `/api/learning/attempts/:attemptUid/answers` | `server/src/routes/learning.js` |
| POST | `/api/learning/attempts/:attemptUid/finish` | `server/src/routes/learning.js` |
| POST | `/api/learning/attempts/:attemptUid/next` | `server/src/routes/learning.js` |
| GET | `/api/learning/attempts/:attemptUid/review` | `server/src/routes/learning.js` |
| GET | `/api/learning/catalog` | `server/src/routes/learning.js` |
| GET | `/api/learning/courses/:courseCode` | `server/src/routes/learning.js` |
| GET | `/api/learning/state` | `server/src/routes/learning.js` |
| GET | `/api/learning/tutor/conversations` | `server/src/routes/learningTutor.js` |
| DELETE | `/api/learning/tutor/conversations/:conversationUid` | `server/src/routes/learningTutor.js` |
| GET | `/api/learning/tutor/conversations/:conversationUid` | `server/src/routes/learningTutor.js` |
| POST | `/api/learning/tutor/hints` | `server/src/routes/learningTutor.js` |
| DELETE | `/api/learning/tutor/history` | `server/src/routes/learningTutor.js` |
| POST | `/api/learning/tutor/interventions/:interventionUid/respond` | `server/src/routes/learningTutor.js` |
| POST | `/api/learning/tutor/interventions/claim` | `server/src/routes/learningTutor.js` |
| POST | `/api/learning/tutor/messages` | `server/src/routes/learningTutor.js` |
| PUT | `/api/learning/tutor/messages/:messageUid/feedback` | `server/src/routes/learningTutor.js` |
| GET | `/api/learning/tutor/practice/:templateCode` | `server/src/routes/learningTutor.js` |
| POST | `/api/learning/tutor/practice/:templateCode/answer` | `server/src/routes/learningTutor.js` |
| GET | `/api/learning/tutor/preferences` | `server/src/routes/learningTutor.js` |
| PATCH | `/api/learning/tutor/preferences` | `server/src/routes/learningTutor.js` |
| GET | `/api/learning/tutor/recommendations` | `server/src/routes/learningTutor.js` |
| GET | `/api/learning/tutor/sources/:sourceCode` | `server/src/routes/learningTutor.js` |
| POST | `/api/notification-delivery/register` | `server/src/routes/notifications.js` |
| GET | `/api/notification-preferences` | `server/src/routes/notifications.js` |
| PATCH | `/api/notification-preferences` | `server/src/routes/notifications.js` |
| GET | `/api/notifications` | `server/src/routes/notifications.js` |
| POST | `/api/notifications/:id/read` | `server/src/routes/notifications.js` |
| POST | `/api/photo-recognition` | `server/src/routes/recognition.js` |
| GET | `/api/privacy/ai-consent` | `server/src/routes/privacy.js` |
| PUT | `/api/privacy/ai-consent` | `server/src/routes/privacy.js` |
| DELETE | `/api/privacy/device-data` | `server/src/routes/privacy.js` |
| GET | `/api/profile` | `server/src/routes/profile.js` |
| PATCH | `/api/profile` | `server/src/routes/profile.js` |
| GET | `/api/restock` | `server/src/routes/restock.js` |
| GET | `/api/sync/state` | `server/src/routes/sync.js` |
| POST | `/api/waste-learning/attempts` | `server/src/routes/wasteLearning.js` |
| POST | `/api/waste-learning/materials/prepare` | `server/src/routes/wasteLearning.js` |
| POST | `/api/waste-learning/profile` | `server/src/routes/wasteLearning.js` |
| GET | `/api/waste-learning/stats` | `server/src/routes/wasteLearning.js` |
| GET | `/privacy` | `server/src/routes/publicPages.js` |
| GET | `/support` | `server/src/routes/publicPages.js` |

The route list expands known loop-defined learning operations. Check the source for any additional dynamic route composition and public-page locale handling.

## Runtime and source assets

- assets/ contains runtime images, GLB models and the food-waste video.
- models/ contains Blender/source projects; it is not an app runtime directory.
- docs/ contains detailed implementation, verification and media-production evidence.
- server/data/assistant-knowledge/ contains ingestion source definitions; server/data/learning-room/v1/ contains versioned learning inputs.
- Build exclusions are defined by .easignore and .vercelignore; add handover exclusion before future native build uploads.

## Scripts

### Root

| Script | Command |
| --- | --- |
| learning:test | `node scripts/test-learning-room.mjs && node scripts/test-learning-gateway.mjs` |
| learning:preview | `node scripts/start-learning-preview.mjs` |
| start | `concurrently --kill-others-on-fail --names api,expo --prefix-colors blue,green "npm run server" "expo start"` |
| start:clear | `concurrently --kill-others-on-fail --names api,expo --prefix-colors blue,green "npm run server" "expo start --clear"` |
| start:expo | `expo start` |
| android | `expo start --android` |
| ios | `expo start --ios` |
| web | `expo start --web` |
| server | `npm --prefix server run dev:learning` |
| server:start | `npm --prefix server start` |

### Server

| Script | Command |
| --- | --- |
| test:learning-tutor | `node --test test/learningTutor.test.js` |
| verify:learning-tutor | `node scripts/verify-learning-tutor.js` |
| eval:learning-tutor | `node scripts/evaluate-learning-tutor.js --live` |
| dev:learning | `node scripts/start-learning-development.js` |
| verify:learning-gateway | `node scripts/verify-learning-gateway.js` |
| verify:learning-room | `node scripts/verify-learning-room.js` |
| backfill:preset-icons | `node scripts/backfill-preset-icons.js` |
| ingest:assistant-knowledge | `node scripts/ingest-assistant-knowledge.js` |
| dev | `node src/index.js` |
| start | `node src/index.js` |
| verify:notification-preferences | `node scripts/verify-notification-preferences.js` |
| verify:expiry-warning-days | `node scripts/verify-expiry-warning-days.js` |
| verify:inventory-outcomes | `node scripts/verify-inventory-outcomes.js` |
| verify:waste-learning | `node scripts/verify-waste-learning.js` |
| verify:achievements | `node scripts/verify-achievements.js` |
| verify:quests | `node scripts/verify-quests.js` |
| verify:api-security | `node scripts/verify-api-security.js` |
| verify:api-security:live | `node scripts/verify-api-security.js --live` |
| verify:assistant-rag | `node scripts/verify-assistant-rag.js` |
| verify:assistant-orchestrator | `node scripts/verify-assistant-orchestrator.js` |
| verify:assistant-scope | `node scripts/verify-assistant-scope.js` |
| verify:assistant-actions | `node scripts/verify-assistant-actions.js` |
| verify:assistant-history | `node scripts/verify-assistant-history.js` |
| verify:profile | `node scripts/verify-profile.js` |
| verify:shared-notifications | `node scripts/verify-shared-notifications.js` |
| verify:sharing | `node scripts/verify-sharing.js` |
| verify:sync | `node scripts/verify-sync.js` |

