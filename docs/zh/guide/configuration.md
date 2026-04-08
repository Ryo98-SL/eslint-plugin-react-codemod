# 配置说明

## Flat Config 接入

插件默认导出一个返回 ESLint Flat Config 的辅助函数：

```ts
import reactCodemod from "eslint-plugin-react-codemod";

export default [
  reactCodemod(),
];
```

你可以通过传参分别开启和定制每条规则。

## `wrapHook`

通过 `wrapHook` 把不稳定的 JSX 值转换成 `useMemo` 或 `useCallback`：

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

常用字段：

- `typeDefinitions`: 是否尝试补充泛型类型与类型 import，默认 `true`
- `allowAttributes`: 允许检查的属性名，支持字符串和正则配置，默认 `["*"]`
- `declarationsPosition`: 顶层常量插入在文件 `start` 或 `end`，默认 `end`
- `ignoredComponents`: 忽略某些组件名，支持字符串和正则配置
- `checkFunction`: 是否处理内联函数，默认 `true`
- `checkArray`: 是否处理内联数组，默认 `true`
- `checkReturnValueOfCalling`: 是否处理调用表达式结果，默认 `true`
- `checkNewExpression`: 是否处理 `new Foo()`，默认 `true`
- `checkRegExp`: 是否处理正则字面量，默认 `true`
- `(useMemo | useCallback).commentOnly`: 只有写了注释时才对对应场景生效，默认 `false`

你也可以接入自定义 hook 别名：

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

通过 `createHook` 在 JSX 引用了未声明标识符时生成 `useRef` 或 `useState`：

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

常用字段：

- `allowAttributes`: 允许自动创建 hook 的属性名，支持字符串和正则配置，默认 `["ref"]`
- `ignoredComponents`: 忽略某些组件名，支持字符串和正则配置
- `typeDefinitions`: 是否尝试补类型，默认 `true`
- `alternates`: 自定义 hook 匹配规则

默认内置规则：

- 命中 `^\w+Ref` 的标识符优先创建 `useRef`
- 命中 `^set(\w+)` 的标识符优先创建 `useState`

例如可以自定义一组替代规则：

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
