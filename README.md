# eslint-plugin-react-codemod

English | [简体中文](https://github.com/Ryo98-SL/eslint-plugin-react-codemod/blob/main/README.zh-CN.md)

A React codemod tool built on top of ESLint autofix.

It focuses on a few repetitive React refactors:

- Automatically wraps inline JSX values such as objects, arrays, functions, and call results with `useMemo` or `useCallback`
- Automatically creates missing `useRef` and `useState` declarations for identifiers used in JSX
- Tries to generate TypeScript types and the related imports when type information is available
- Runs as a lightweight codemod through `eslint --fix` or your editor's save action

This project is inspired by [eslint-plugin-command](https://github.com/antfu/eslint-plugin-command), but it focuses specifically on React hook wrapping and hook creation.

⚠️ To integrate it into your project, make sure your project already depends on `typescript`.

## Why

These patterns are common in React codebases:

- Inline objects, arrays, and anonymous functions are passed directly into JSX props, causing unstable references
- A `ref` or setter is needed in JSX, but the variable has not been declared yet
- Manual refactors are repetitive and easy to get wrong when imports, types, and dependency arrays are involved

`eslint-plugin-react-codemod` turns those repetitive fixes into codemods by combining ESLint rules with autofix.

## Installation

```bash
pnpm add -D eslint-plugin-react-codemod
```

If your project already has ESLint 9 and TypeScript set up, installing this plugin is enough.

## Quick Start

This plugin targets ESLint Flat Config.

```ts
// eslint.config.js

import reactCodemod from "eslint-plugin-react-codemod";

export default [
  reactCodemod(),
];
```

Then run:

```bash
eslint . --fix
```

You can also rely on your editor's ESLint save action to apply fixes on save.

## Features

The plugin currently provides two rules:

### `react-codemod/wrap-hook`

Detects inline JSX prop values and automatically fixes them into:

- `useMemo`
- `useCallback`
- or a top-level constant when that is safe

Supported value kinds include:

- object literals
- array literals
- inline functions
- call expression results
- `new` expressions
- regular expressions

### `react-codemod/create-hook`

When JSX uses an identifier that has not been declared yet, the rule creates a hook based on its naming pattern:

- `dialogRef` -> `useRef(...)`
- `setWidth` -> `useState(...)`
- `setDialogNode` -> `useState(...)`

It also tries to infer the generic type from the target component prop when possible.

## Examples

### 1. Wrap values with `useMemo` / `useCallback`

Input:

```tsx
import { Modal } from "./Modal";

function Demo(props: { text: string; backgroundColor: string }) {
  return (
    <Modal
      info={{ size: 10, backgroundColor: props.backgroundColor }}
      onClick={() => {
        console.log(props.text);
      }}
    />
  );
}
```

After `eslint --fix`:

```tsx
import { Modal } from "./Modal";
import { useCallback, useMemo } from "react";

function Demo(props: { text: string; backgroundColor: string }) {
  const modalInfo = useMemo(
    () => ({ size: 10, backgroundColor: props.backgroundColor }),
    [props.backgroundColor],
  );

  const handleModalClick = useCallback(() => {
    console.log(props.text);
  }, [props.text, props]);

  return <Modal info={modalInfo} onClick={handleModalClick} />;
}
```

### 2. Create `useRef` automatically

Input:

```tsx
import { Dialog } from "./Dialog";

const Demo = () => <Dialog ref={dialogRef} />;
```

After fixing:

```tsx
import { Dialog, type DialogAPI } from "./Dialog";
import { useRef } from "react";

const Demo = () => {
  const dialogRef = useRef<DialogAPI>(null);
  return <Dialog ref={dialogRef} />;
};
```

### 3. Create `useState` automatically

Input:

```tsx
import { Dialog } from "./Dialog";

const Demo = () => <Dialog width={setWidth} variant={setVariant} />;
```

After fixing:

```tsx
import { Dialog } from "./Dialog";
import { useState } from "react";

const Demo = () => {
  const [width, setWidth] = useState<Parameters<typeof Dialog>[0]["width"] | null>(null);
  const [variant, setVariant] = useState(null);

  return <Dialog width={setWidth} variant={setVariant} />;
};
```

## Comment-Driven Mode

`wrap-hook` supports command-style comments directly above a prop to explicitly choose the hook to apply.

For example:

```tsx
<Modal
  // useCallback
  onClick={() => console.log(size)}
  // useMemo
  info={buildInfo(size)}
/>
```

After fixing:

- `onClick` is extracted into `useCallback`
- `info` is extracted into `useMemo`
- the trigger comments are removed automatically

If you only want transformations to run when a comment is present, set `commentOnly: true`.

Do not annotate `onClick` with `// useMemo`, and do not annotate `info` with `// useCallback`. Only function-like expressions can be handled as `useCallback`; all other supported value types belong to the `useMemo` family. This also matters when you define custom `alternates`.

## Configuration

### `wrapHook`: wrap into `useMemo` or `useCallback`

```ts
import reactCodemod from "eslint-plugin-react-codemod";

export default [
  reactCodemod({
    wrapHook: [
      "warn",
      {
        typeDefinitions: true,
        declarationsPosition: "end",
        checkFunction: true,
        checkArray: true,
        checkReturnValueOfCalling: true,
        checkNewExpression: true,
        checkRegExp: true,
        ignoredComponents: ["div", { pattern: "^Icon" }],
        useCallback: {
          commentOnly: false,
          prefer: "useCallback",
        },
        useMemo: {
          commentOnly: false,
          prefer: "useMemo",
        },
      },
    ],
  }),
];
```

Common fields:

- `typeDefinitions`: tries to add generic types and type imports, default `true`
- `declarationsPosition`: inserts hoisted top-level constants at `start` or `end`, default `end`
- `ignoredComponents`: ignores specific component names, supports strings and regex configs
- `checkFunction`: handles inline functions, default `true`
- `checkArray`: handles inline arrays, default `true`
- `checkReturnValueOfCalling`: handles call expression results, default `true`
- `checkNewExpression`: handles `new Foo()`, default `true`
- `checkRegExp`: handles regex literals, default `true`
- `(useMemo | useCallback).commentOnly`: only runs the corresponding transform when a trigger comment is present, default `false`

You can also plug in custom hook aliases:

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

### `createHook`: create `useState` or `useRef`

```ts
import reactCodemod from "eslint-plugin-react-codemod";

export default [
  reactCodemod({
    createHook: [
      "warn",
      {
        allowAttributes: ["ref", { pattern: "^on[A-Z]" }, "width", "variant"],
        ignoredComponents: [{ pattern: "^(Pure|[a-z])" }],
        typeDefinitions: true,
      },
    ],
  }),
];
```

Common fields:

- `allowAttributes`: which prop names are allowed to auto-create hooks, supports strings and regex configs, default `["ref"]`; you can use `["*"]` for all props, but it may affect performance
- `ignoredComponents`: ignores specific component names, supports strings and regex configs
- `typeDefinitions`: tries to generate types, default `true`
- `alternates`: custom hook matching rules

Built-in defaults:

- identifiers matching `^\w+Ref` prefer `useRef`
- identifiers matching `^set(\w+)` prefer `useState`

Example with custom alternates:

```ts
import reactCodemod from "eslint-plugin-react-codemod";

export default [
  reactCodemod({
    createHook: [
      "warn",
      {
        allowAttributes: ["*"],
        alternates: [
          {
            kind: "reference",
            hookName: "useComposedRef",
            hookModulePath: "@radix-ui/react-compose-refs",
            isDefaultExport: false,
            matchPattern: "^composedRef$",
          },
          {
            kind: "state",
            hookName: "useAtom",
            hookModulePath: "jotai",
            isDefaultExport: false,
            matchPattern: "^set(\\w+)",
            stateVariableNamePattern: "$1",
          },
        ],
      },
    ],
  }),
];
```

## Good Fit

This plugin works well for:

- gradual React performance cleanup in older codebases
- batch removal of inline JSX references in component libraries or app code
- automatically filling in missing `ref` and state hook declarations
- keeping one-off codemods inside the normal ESLint workflow

## Design

This is not just a code quality plugin. It treats ESLint as a lightweight codemod engine:

- rules locate React patterns that can be rewritten
- autofix emits the final code transformation
- TypeScript parser services help infer types and imports
- comments and rule options control when a transformation should run

That is also where it aligns with `eslint-plugin-command`: extending ESLint from "reporting issues" to "executing one-off refactors".

## Limitations

- It currently targets React function components in `tsx` and `jsx`
- Type-related fixes require ESLint to have working TypeScript project services
- Generated dependency arrays and type extraction are heuristic-based and should be reviewed in complex cases
- It is best suited for small, batchable codemods rather than large migration scripts

## Development

```bash
bun install
bun test
bun build
```

## License

MIT
