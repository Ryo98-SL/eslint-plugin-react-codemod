# Getting Started

## Installation

Install the plugin into a project that already has ESLint 9 and TypeScript:

```bash
pnpm add -D eslint-plugin-react-codemod
```

This plugin targets ESLint Flat Config.

```ts
// eslint.config.js

import reactCodemod from "eslint-plugin-react-codemod";

export default [
  reactCodemod(),
];
```

Then use your editor's ESLint fix suggestions to apply fixes.

Or run:

```bash
eslint Foo.tsx  --fix
```

## Good Fit

This plugin works well for:

- gradual React performance cleanup in older codebases
- batch removal of inline JSX references in component libraries or app code
- automatically filling in missing `ref` and state hook declarations
- keeping one-off codemods inside the normal ESLint workflow

## Limitations

- It currently targets React function components in `tsx` and `jsx`
- Type-related fixes require ESLint to have working TypeScript project services
- Generated dependency arrays and type extraction are heuristic-based and should be reviewed in complex cases
- It is best suited for small, batchable codemods rather than large migration scripts

## Documentation Development

The repository uses `bun` workspaces. Install dependencies from the project root:

```bash
bun install
```

Start the VitePress site:

```bash
bun run docs:dev
```

Build the static output:

```bash
bun run docs:build
```

Preview the production build locally:

```bash
bun run docs:preview
```

The generated site is written to `docs/.vitepress/dist`.

## GitHub Pages Deployment

The documentation site is configured for the GitHub Pages project site path:

```txt
/eslint-plugin-react-codemod/
```

That matches the default URL:

```txt
https://ryo98-sl.github.io/eslint-plugin-react-codemod/
```

If the repository name or GitHub account changes, update `docs/.vitepress/config.ts`.
