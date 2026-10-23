# Aditya Gaur — Portfolio

Personal portfolio for adityagaur.dev: selected projects, case studies, achievements, experience, and résumé. Built as a static site with Node.js templates, plain CSS, and browser JavaScript.

## Development

Requires Node.js 20 or newer. Building and serving the site need no installed dependencies.

~~~sh
npm run dev
~~~

Open http://localhost:3000. Files in src/ and public/ rebuild on change; refresh to see updates. The PORT environment variable selects a different port.

~~~sh
npm run build
npm run preview
npm test
~~~

The production output is dist/. It includes the homepage, nine case studies, résumé page, custom 404, sitemap, and local assets. Any static host with directory index support can serve it. Nothing is deployed by these commands.

## Content and design

- src/projects.json — project descriptions, case studies, links, roles, and status.
- src/journey.mjs — homepage structure and résumé page.
- src/chapters.mjs — recognition, personal chapters, and tech stack content.
- src/hero.mjs — hero lettering and handwritten signature intro.
- src/pages.mjs — case-study pages and 404.
- src/components.mjs — navigation, contact, project illustrations, and metadata.
- public/experience.js — scroll choreography, theme and motion controls, intro lifecycle.
- public/sheets.js — GPU mesh for the Selected Work cards: shared barrel geometry, cursor flex, and a fluid ink pour (a flow map baked per pour, swept each frame); Canvas 2D fallback.
- public/ink.js — the ink renderer: one offscreen WebGL2 fluid + marbling pass draws every [data-ink] word into a small mirror canvas inside the word's own container, so ink scrolls, clips and fades natively with its text. It sleeps whenever nothing changes.
- public/ink-math.js, public/hero-state.js — pure reveal / layout helpers (unit-tested in tests/) and the hero letter state shared with experience.js.
- public/ink.css — ink mirrors, hero centring and light-theme name colours.
- public/sections.js, public/sections.css — home-section choreography: the Build Gazette front page, scissor-cut clippings, the person section and playground hand, toolkit specimen rows, and the barrel edge bands at the top and bottom of the screen.
- public/case-ink.js — the marbled ink behind each case-study opening, in the project's own tones.
- public/chapters.js — the playground's hand of flip cards (legal knight moves, drum kit / sequencer, word composition), started the first time a card is turned over.
- public/chapters.css — responsive editorial chapter layouts and readable typography.
- public/chapter-motion.js — scroll-bound heading masks and copy reveals.
- src/tech-icons.json — Simple Icons brand marks (currently unused; license in public/assets/tech/).
- public/experience.css — themes and responsive motion layouts.
- public/styles.css — shared base and case-study styles.
- public/app.js — project filtering and email copy.

Dark mode uses a plain black background; light mode a plain white one with periwinkle accents and a near-black name. The hero name is filled with marbled ink: the cursor stirs it and paints "Aditya"; on phones (or an idle desktop) a slow brush does it, and tilting a phone sloshes it. Scrolling drains ink from the name and floods each section's accent word as it arrives. Ink only moves when something moves it. The intro plays on direct homepage visits and refreshes, can be skipped, and is disabled for reduced-motion preferences. Internal home links and browser history return immediately without replaying it. Gallery cards bend along a shared cylinder (a pinned sideways track on desktop, a swipe row on phones) and pour their colour in like ink. The page itself rolls over a barrel at the top and bottom of the screen (a backdrop warp in Chromium browsers, a shaded fade elsewhere). Case studies keep a plain title over marbled ink in the project's tones. The theme toggle is the small sun/moon beside "Let's talk". Without WebGL2 or JavaScript every word stays plain, readable text.

Contact: gauraditya@outlook.in. Canonical domain: adityagaur.dev. Repository: https://github.com/xdityagr/my-portfolio.

## Story chapters

Recognition leads with the SIH 2024 national win and ₹75,000 project funding. The achievement wall includes the supplied HackForge, HackX, Craft N Code, Udyamotsav, MoE presentation, CodeRed, Youth Ideathon, and other milestones. Design Championship is recorded as the confirmed 2023 Senior Coding runner-up, with the official results link. The interview link points to the supplied MoE Innovation Cell YouTube video.

The SIH feature is a broadsheet front page, "The Build Gazette": its pressed headline soaks up ink, the AICTE interview is a giant pull quote beside the build and its ₹75,000 funding (counted up once), and an inked sensor graph runs the full width below. Highlights are scissor-cut clippings that fall into place in 3D and tilt under the pointer (a sideways row on phones). The person section holds its heading while "code." floods; the playground is a hand of three cards (knight paths, a three-voice drum kit with an eight-step sequencer, a word-composition canvas) that turn over in 3D, start on first turn, and play audio only from a visitor action. The toolkit is a type specimen of slowly drifting rows that can be dragged by hand, with an accessible list of every tool. Reduced motion and the pause control show every section complete and still. All story content remains readable without JavaScript.

## Résumé

The page displays a high-resolution image to avoid reliance on browser PDF plugins. Opening or downloading the PDF requires an explicit link click. Replace public/resume.pdf and regenerate public/assets/resume-preview.png together. The current preview is 2382 × 3369 pixels.

## Verification

~~~sh
npm install
npx playwright install chromium
npm run dev
npm run test:browser
~~~

Browser checks cover responsive layouts, all case studies, filters, keyboard navigation, touch, no-JavaScript fallback, reduced motion, repeat intro playback, card hover and cursor interactions, theme persistence, and résumé rendering without automatic downloads.

TEST_BASE_URL defaults to http://localhost:3000. PLAYWRIGHT_MODULE_PATH and PLAYWRIGHT_EXECUTABLE_PATH can point to an existing local Playwright installation and browser.

npm test builds and checks all 12 HTML pages, local links, anchor targets, project records, and critical assets.

## Hosting

vercel.json configures the Other framework preset, npm run build, and the dist output directory. Dependency installation is skipped because the production build uses only Node.js built-ins; Playwright is needed only for local browser tests. No environment variables or runtime API keys are required.

Import xdityagr/my-portfolio into Vercel, keep the root directory at the repository root, and select main as the production branch. The committed configuration supplies the build settings. Directory routes use trailing slashes, and the PDF is served inline unless the download link is used. The custom domain adityagaur.dev is referenced in metadata; connect it separately after the deployment is verified.

## Assets

Fonts are self-hosted under the SIL Open Font License; license texts accompany them in public/assets/. StarForge's chart is actual project output. The other project artwork is custom illustrative UI. Local research, reference screenshots, generated output, and QA screenshots are excluded from Git.

## Card rendering

Featured artwork is rendered from the same HTML illustrations into compact WebP textures by scripts/render-card-textures.mjs. Run this script against a running local preview after changing the illustration content/styles; it accepts the same Playwright override variables as the browser tests. Commit the generated public/assets/cards files. Textures load near the viewport, DPR is capped, and surfaces draw only when their geometry or ink changes. WebGL failure falls back to an animated Canvas 2D surface; HTML artwork remains available while textures load and without JavaScript.
