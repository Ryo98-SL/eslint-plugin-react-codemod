# Configuration

## Flat Config

The plugin exports a default helper that returns ESLint Flat Config:

```ts
import reactCodemod from "eslint-plugin-react-codemod";

export default [
  reactCodemod(),
];
```

You can enable and customize each rule through the helper options.

## `wrapHook`

Use `wrapHook` to transform unstable JSX values into `useMemo` or `useCallback`:

```ts
import reactCodemod from "eslint-plugin-react-codemod";

export default [
  reactCodemod({
    wrapHook: [
      "warn",
      {
        typeDefinitions: true,
        allowAttributes: ["onClick", { pattern: "^(info|sx)$" }],
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
- `allowAttributes`: limits which prop names are checked, supports strings and regex configs, default `["*"]`
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

## `createHook`

Use `createHook` to generate `useRef` or `useState` when JSX refers to identifiers that do not exist yet:

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

- `allowAttributes`: which prop names are allowed to auto-create hooks, supports strings and regex configs, default `["ref"]`
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
