# KitchMemo Release and Delivery Register

This register identifies what is being handed over. Status is based on inspected files and dated evidence as of 12 October 2026; links requiring platform membership must be checked by the receiver.

## Source baseline

- Repository: https://github.com/Gress-FIT5120-26S2/Gress
- Inspected commit: `a37304cd7746f61872673cc9d8d05e8f7536badf`
- Commit description: `docs: archive iPhone screenshots and App Review submission`
- Product version: 1.0.0. Package version: 1.0.
- The pre-existing untracked `deliverables/project-introduction/` was used as local product/team evidence. It is not assumed to be present in the baseline commit. Record its accepted archive or committed revision at closure.
- No final release tag or sponsor acceptance was found. The receiver should freeze the accepted repository revision and register its tag after review.

## Installation and release records

| Item | Recorded baseline | Status and limitation |
| --- | --- | --- |
| Production API | https://kitchmemo-api.vercel.app | Privacy release record reports successful deployment and HTTP checks |
| API deployment | `dpl_6U6SySnCErJWZoVgicd4gLTuAJS8` | Latest recorded privacy release; newer than the earlier learning deployment |
| iOS | 1.0.0 build 13; source `d08a8f8` | Built, uploaded, selected and submitted; Apple approval not recorded |
| iOS EAS build | `cf0f5559-c8df-4691-8e90-31a58f712ba0` | https://expo.dev/accounts/gress-fit5120-26s2/projects/kitchmemo/builds/cf0f5559-c8df-4691-8e90-31a58f712ba0 |
| iOS installation | Existing internal TestFlight groups | Receiver membership or a distributable invitation still needs confirmation; an App Store-signed IPA is not a general sideload installer |
| Android | preview APK 1.0.0, versionCode 3; source `22ecd7b` | Latest privacy-era preview recorded, not a Google Play production release |
| Android EAS build | `bf42979c-bda5-4cc9-8302-ef308c5960bf` | https://expo.dev/accounts/gress-fit5120-26s2/projects/kitchmemo/builds/bf42979c-bda5-4cc9-8302-ef308c5960bf |
| Android APK | EAS artifact | https://expo.dev/artifacts/eas/H9e3TQYE6Cjz9r1KkI35og0WOUDiJmd7-m4QlGXMWjQ.apk |
| Apple app | App ID `6805763159`; bundle `com.gressfit5120.kitchmemo` | Initial release is iPhone-only; Australian availability configured |
| Database | 58 migrations through `20261012100000_app_store_privacy_and_erasure.sql` | Latest record states development and production aligned |
| Learning course | `learning-room-v1`, published | 3 courses, 9 activities, 9 resources, 48 questions, 18 sources |
| Learning tutor | `learning-tutor-v3`, published | Owner-reviewed exception; independent review pending; v1/v2 historical drafts preserved |

Older iOS builds 11 and 12 and earlier Android preview artifacts are historical. Build 11 predates privacy/deletion functionality; build 12 still supported iPad. Do not substitute these as the current acceptance target.

## Public and presentation materials

- Privacy policy: https://kitchmemo-api.vercel.app/privacy
- Support: https://kitchmemo-api.vercel.app/support
- Registered public operator/contact: Haoxuan Sun, nariyirm@gmail.com
- Product page recorded in local introduction materials: https://eportfolio.monash.edu/view/view.php?id=274372. Anonymous access to every referenced asset is not established.
- Product film: `08_Product_Video/KitchMemo_90s_Final_v12.mp4`; 90 seconds, English captions, 1280 by 720, 24 fps. Narrative scenes are creative demonstrations, not evidence of measured household outcomes.
- PG Google Drive URL, final Agile board URL and hosted film URL: see `Information_Required.csv`; not available in inspected materials.

## Acceptance boundaries

The published build and schema records are historical evidence, not a new verification of platform state. A receiving organisation must confirm installation access, run UAT, inspect current scheduled-job history and select an ongoing owner. The package does not promise a support SLA, provider subscription coverage, an independent security certification or measured food-waste reduction.
