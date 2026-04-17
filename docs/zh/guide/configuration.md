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

## Presets

默认导出同时提供了一组面向常见 React 技术栈的官方 preset：

```ts
import reactCodemod from "eslint-plugin-react-codemod";

export default [
  reactCodemod(
    reactCodemod.compose(
      reactCodemod.presets.ahooks(),
      reactCodemod.presets.radix(),
      {
        wrapHook: ["warn", { allowAttributes: ["onClick", "sx"] }],
      },
    ),
  ),
];
```

可用 preset：

- `reactCodemod.presets.ahooks()`：优先生成 `useMemoizedFn` 和 `useCreation`
- `reactCodemod.presets.mui()`：聚焦 `sx`、`slotProps`、`componentsProps` 等常见 MUI prop
- `reactCodemod.presets.radix()`：为 `createHook` 增加 `useComposedRef` 支持
- `reactCodemod.presets.jotai()`：为 `createHook` 增加 `useAtom` 支持

`reactCodemod.compose(...)` 会合并 rule level、`alternates` / `allowAttributes` 等数组字段，以及 `useMemo` / `useCallback` 的嵌套配置，方便把 preset 和本地覆写安全组合起来。

## 环境默认行为

当检测到以下生产类环境时，`reactCodemod()` 会把两条 rule 默认设为 `off`：

- `CI=true`
- `CI=1`
- `NODE_ENV=production`

这样可以避免在 CI 流水线或生产构建里误执行 codemod。如果你希望手动开启，可以显式传入 rule 配置：

```ts
import reactCodemod from "eslint-plugin-react-codemod";

export default [
  reactCodemod({
    wrapHook: ["warn"],
    createHook: ["warn"],
  }),
];
```

## `alternates`

`alternates` 用来注册可识别的替代实现，让插件知道某个 hook 还有哪些等价或扩展用法。

如果你希望自动修复时优先使用某个 hook 名，需要再配合 `prefer` 明确指定目标 hook。两者通常一起使用：`alternates` 负责注册，`prefer` 负责选择。

### `wrapHook` 中的 `alternates`

下面的配置先通过 `alternates` 注册 `ahooks` 的替代实现，再通过 `prefer` 指定优先生成 `useMemoizedFn` 和 `useCreation`：

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

### `createHook` 中的 `alternates`

你也可以让插件按命名模式生成自定义 hook：

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
