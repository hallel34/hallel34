---
name: pr-preview-pages
description: Set up GitHub Actions so every pull request deploys a live preview to GitHub Pages and main deploys production. Use when configuring CI/CD or Vite base paths for פסיבו (Passivo).
---
# PR previews on GitHub Pages

## Approach
Pages serves one site from the `gh-pages` branch. Production lives at
the root; each PR goes to `/pr-preview/pr-<N>/`. Use
`rossjrw/pr-preview-action` (check for its latest major version).

## Repo settings (tell the CEO if you can't set them)
- Settings → Pages → Source: "Deploy from a branch" → `gh-pages` / root.
- Settings → Actions → Workflow permissions: read and write.

## Vite base
Base path must be configurable:
```js
// vite.config.js
export default { base: process.env.BASE_PATH || '/' }
```
- Production: `BASE_PATH=/<repo>/`
- Preview: `BASE_PATH=/<repo>/pr-preview/pr-<N>/`
Service worker scope and manifest `start_url` must use the same base —
use relative paths (`./`) in manifest.

## Workflows
`.github/workflows/preview.yml` — on `pull_request` (opened,
reopened, synchronize, closed): checkout → setup node → `npm ci` →
`npm test` → build with preview BASE_PATH → pr-preview-action with
`source-dir: dist`. Needs `permissions: contents: write, pull-requests: write`
and `concurrency: preview-${{ github.ref }}`.

`.github/workflows/deploy.yml` — on push to `main`: test, build with
production BASE_PATH, deploy to `gh-pages` root (e.g.
JamesIves/github-pages-deploy-action with `clean-exclude: pr-preview`
so previews aren't wiped).

## Verify
After the PR workflow runs, the action comments the URL on the PR.
Open it at 360x800 and confirm assets load (no 404s from wrong base).
