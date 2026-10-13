# KitchMemo single-file project introduction

## Upload this file

### Monash ePortfolio / Some HTML

Use **`KitchMemo-Introduction-Final.html`** for the Monash **Some HTML** block. `mahara-compatible.html` and `KitchMemo-Introduction-Desktop.html` are identical generated copies. Inspection of the actual block on 12 October 2026 confirmed that it removed the original `<style>`, all 19 data-URL images, sectioning / disclosure tags, and `display` CSS. This version uses ordinary `div` elements, inline CSS, percentage floats for desktop columns, and HTTPS image sources. It is still one uploaded HTML file, but its pictures require internet access. Public repository assets are pinned to commit `bc2ca53af5cb55598ecc117860624598d611f555`; the kitchen picture reuses the existing Iteration 1 portfolio asset. The Learning Academy picture is an actual October verification capture rather than the unhosted product-video capture.

With the owner's approval, the final file was uploaded and saved to [KitchMemo Product](https://eportfolio.monash.edu/view/view.php?id=274372), block `1030648`, uploaded file `596733`. Verified on the actual display page: all eight images loaded, all four column pairs rendered side by side, no horizontal overflow, and Iteration 3 has no Planned label. The platform theme forces dark heading text, so the film heading uses an explicitly white child span; its computed colour was verified as `rgb(255, 255, 255)`. `mahara-live-desktop.jpg`, `mahara-live-preview.jpg` and `mahara-live-verification.json` record this final result. Per the owner's direction, final verification focuses on desktop; earlier local/mobile previews are historical. `build-mahara.mjs` regenerates all three compatible copies.

The reused Monash kitchen image loaded in the signed-in browser. A separate anonymous HTTP check returned an HTML challenge, so its access for signed-out reviewers remains unverified and depends on the original portfolio's permissions.

### Standalone web hosting

**`index.html` is the complete deliverable.** Upload only this file to the hosting platform. It can also be opened directly in a browser by double-clicking it. All CSS and all image assets are embedded; there are no external fonts, stylesheets, scripts, image files or runtime dependencies. Navigation and the expandable Wins screenshots use native HTML. The external LinkedIn and original portfolio links need internet access when opened.

The page is in English and includes the project name, background and purpose, a welcome for industry mentor Hilda Permata, three completed iterations, a product-film cover, and Team Gress. Following the project owner's update, Iteration 3 is presented as completed, with no Planned or completion badges. Its two main features are Learning Academy and Shared Fridge.

## Add the video manually

The `film` section currently contains a static cover and caption, not a video player. Add the video using your hosting platform's media block, as planned. If you obtain a hosted video URL and want it inside the HTML, replace the `.film-cover` area with a native `<video controls playsinline preload="metadata">` player or the provider's embed, and retain the section heading and caption. An externally hosted video will require internet access for playback.

An existing final film is at `docs/art-direction/product-video/production-90s-v4/final-v12/KitchMemo_90s_Final_v12.mp4` in the project repository. The movie itself is intentionally excluded from the HTML.

## Preview and maintenance

- `desktop-preview.jpg` and `mobile-preview.jpg` are browser screenshots of the implemented page.
- `design-preview-v1.png` is the originally approved design concept. Its Planned label predates the owner's update that Iteration 3 is complete.
- `src/page.html` is the readable source template, and `build-html.mjs` embeds optimized images into the final file. From the repository root, run `node deliverables/project-introduction/build-html.mjs` after editing the template.
- `source-assets/` retains the generated kitchen illustration and the original Iteration 2 screenshots. These files are build inputs; visitors do not need them.
- `preview-server.mjs` serves only the final HTML at `http://127.0.0.1:8792/index.html` for local review. It is not required for hosting or direct opening.

## Visual assets and sources

The decorative kitchen hero was generated with the built-in imagegen tool to match the approved design. Its prompt is in `HERO_PROMPT.md`. It is illustration, not a screenshot of the live 3D scene.

The Logo, Spoonie, shared-fridge family illustration, mountain and medals use existing repository brand assets. Inventory and learning interfaces use existing App captures from `docs/art-direction/product-video/narrative-local-v1/production/ui/`. The inventory images are captioned as current App screens, not as historical Iteration 1 captures. Wins, medal-wall and quest screenshots were exported from the owner's [Iteration 2 portfolio](https://eportfolio.monash.edu/view/view.php?t=91864bcd6724f3369d72). The film cover uses an existing product-video still.

The historical content is based on the owner's [Iteration 1 portfolio](https://eportfolio.monash.edu/view/view.php?t=437f0c2c53a9242490ab), Iteration 2 portfolio and direct explanation of Iteration 3. Team names and majors follow the Iteration 1 page. Hilda's link is the LinkedIn profile supplied by the owner; no portrait or endorsement quote was invented.

## Verification

Verified in a browser at desktop, 768px, 390px and 320px viewport widths. Checked horizontal overflow, in-page navigation, opening and closing the Wins screenshots, and embedded image display. Native HTML features work without JavaScript; the page contains no script tags. Reduced-motion preferences disable smooth scrolling and button movement. See `verification.json` for the final file's structural checks.
