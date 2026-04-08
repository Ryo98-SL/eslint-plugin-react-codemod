# Contribute

## Docs Workspace

The documentation site lives in its own workspace package:

```txt
docs/
```

Its `package.json` contains only the VitePress-specific scripts and dependency, so the docs site can evolve independently from the plugin package.

## Root Scripts

The repository root exposes convenience commands:

```bash
bun run docs:dev
bun run docs:build
bun run docs:preview
```

These commands forward into the `docs` workspace package.

## Site Config

Key settings in `docs/.vitepress/config.ts`:

- `base`: ensures assets resolve correctly on GitHub Pages project sites
- `locales`: provides English and Simplified Chinese entry points
- `cleanUrls`: removes `.html` suffixes from generated URLs
- `search.provider`: enables local search without external services
- `editLink`: links every page back to the GitHub repository

## Content Structure

Current content is organized as:

```txt
docs/
  .vitepress/
  guide/
  zh/
  public/
  index.md
  examples.md
```

## Deployment

The documentation site is built as a GitHub Pages project site. The VitePress `base` is:

```txt
/eslint-plugin-react-codemod/
```

If the repository name or GitHub account changes, update the base path and related links in the VitePress config.
