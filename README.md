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
- src/journey.mjs — homepage sections and résumé page.
- src/hero.mjs — hero lettering and handwritten signature intro.
- src/pages.mjs — case-study pages and 404.
- src/components.mjs — navigation, contact, project illustrations, and metadata.
- public/experience.js — scroll choreography, theme and motion controls, intro lifecycle.
- public/sheets.js — shared barrel geometry, cursor flex, and organic ink reveal.
- public/experience.css — themes and responsive motion layouts.
- public/styles.css — shared base and case-study styles.
- public/app.js — project filtering and email copy.

Dark mode uses black and white. Light mode keeps white backgrounds with cool blue and sage typography. The intro plays on direct homepage visits and refreshes, can be skipped, and is disabled for reduced-motion preferences. Internal home links and browser history return immediately without replaying it. Gallery cards bend along a shared cylinder on desktop; touch layouts stack cards and reveal color as they enter view. Navigation and content remain usable without JavaScript.

Contact: gauraditya@outlook.in. Canonical domain: adityagaur.dev. Repository: https://github.com/xdityagr/my-portfolio.

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
