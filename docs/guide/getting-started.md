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

If your project already follows common library conventions, you can start with an official preset and compose multiple presets when needed:

```ts
import reactCodemod from "eslint-plugin-react-codemod";

export default [
  reactCodemod(
    reactCodemod.compose(
      reactCodemod.presets.ahooks(),
      reactCodemod.presets.radix(),
    ),
  ),
];
```

`reactCodemod()` is also environment-aware: when `CI=true`, `CI=1`, or `NODE_ENV=production` is detected, it defaults both rules to `off`. If you still want to run codemods in those environments, enable the rules explicitly:

```ts
import reactCodemod from "eslint-plugin-react-codemod";

export default [
  reactCodemod({
    wrapHook: ["warn"],
    createHook: ["warn"],
  }),
];
```

Then use your editor's ESLint fix suggestions to apply fixes.

Or run:

```bash
eslint Foo.tsx  --fix
```

## Configuration

If you want the plugin to recognize alternative hook implementations already used in your project, start by configuring `alternates`. If you want autofix to prefer a specific hook name, then use `prefer` to select it explicitly.

For common setups, you can skip most manual wiring and begin with an official preset:

- `reactCodemod.presets.ahooks()`
- `reactCodemod.presets.mui()`
- `reactCodemod.presets.radix()`
- `reactCodemod.presets.jotai()`

For example, if your project already uses `ahooks`:

```ts
import reactCodemod from "eslint-plugin-react-codemod";

export default [
  reactCodemod({
    wrapHook: [
      "warn",
      {
        useCallback: {
          prefer: "useMemoizedFn",
          alternates: [
            {
              hookName: "useMemoizedFn",
              hookModulePath: "ahooks",
              isDefaultExport: false,
              withDepList: false,
            },
          ],
        },
        useMemo: {
          prefer: "useCreation",
          alternates: [
            {
              hookName: "useCreation",
              hookModulePath: "ahooks",
              isDefaultExport: false,
              withDepList: true,
            },
          ],
        },
      },
    ],
  }),
];
```

If you need to generate custom hooks based on naming conventions, you can also configure `alternates` in `createHook`. See the Configuration page for the full field reference.

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
