# eslint-plugin-react-codemod

[English](./README.md) | 简体中文

一个基于 ESLint 自动修复能力实现的 React codemod 工具。

它专注解决 React 组件中常见的几个机械性重构场景：

- 自动把 JSX 内联对象、数组、函数、调用结果等提取为 `useMemo` 或 `useCallback`
- 自动为缺失的 `ref` / setter 变量创建 `useRef` 或 `useState`
- 在可推断时补充 TypeScript 类型与对应 import
- 通过 `eslint --fix` 或编辑器保存动作完成一轮轻量 codemod

项目灵感来自 [eslint-plugin-command](https://github.com/antfu/eslint-plugin-command)，但这里的关注点是 React 场景下的 hook 包装与 hook 创建。

⚠️ 如果需要集成到你的项目，目前需要保证项目依赖了 `typescript`。

## 为什么做这个

在 React 代码里，下面几类问题很常见：

- JSX props 中直接传入内联对象、数组、匿名函数，导致引用不断变化
- 组件需要 `ref` 或状态 setter，但变量还没来得及声明
- 手动重构这类代码重复度高，而且容易漏掉 import、类型和依赖数组

`eslint-plugin-react-codemod` 利用 ESLint rule + autofix 的方式，把这些重复劳动变成可批量执行的 codemod。

## 安装

```bash
pnpm add -D eslint-plugin-react-codemod
```

如果你的项目已经具备 ESLint 9 + TypeScript 运行环境，只需要再安装本插件即可。

## 快速开始

这个插件面向 ESLint Flat Config。

```ts
// eslint.config.js

import reactCodemod from "eslint-plugin-react-codemod";

export default [
  reactCodemod(),
];
```

然后执行：

```bash
eslint . --fix
```

也可以直接依赖编辑器的 ESLint save action，在保存时自动完成修复。

## 功能概览

目前提供两条规则：

### `react-codemod/wrap-hook`

检测 JSX 属性中的内联值，并自动修复为：

- `useMemo`
- `useCallback`
- 或在安全场景下抽到文件顶层常量

支持处理的值类型包括：

- 对象字面量
- 数组字面量
- 内联函数
- 调用表达式返回值
- `new` 表达式
- 正则

### `react-codemod/create-hook`

当 JSX 中使用了尚未声明的标识符时，按命名模式自动补出 hook：

- `dialogRef` -> `useRef(...)`
- `setWidth` -> `useState(...)`
- `setDialogNode` -> `useState(...)`

并尽量根据目标组件 props 类型补出泛型类型。

## 效果示例

### 1. 自动包装 `useMemo` / `useCallback`

输入：

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

执行 `eslint --fix` 后：

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

### 2. 自动创建 `useRef`

输入：

```tsx
import { Dialog } from "./Dialog";

const Demo = () => <Dialog ref={dialogRef} />;
```

执行后：

```tsx
import { Dialog, type DialogAPI } from "./Dialog";
import { useRef } from "react";

const Demo = () => {
  const dialogRef = useRef<DialogAPI>(null);
  return <Dialog ref={dialogRef} />;
};
```

### 3. 自动创建 `useState`

输入：

```tsx
import { Dialog } from "./Dialog";

const Demo = () => <Dialog width={setWidth} variant={setVariant} />;
```

执行后：

```tsx
import { Dialog } from "./Dialog";
import { useState } from "react";

const Demo = () => {
  const [width, setWidth] = useState<Parameters<typeof Dialog>[0]["width"] | null>(null);
  const [variant, setVariant] = useState(null);

  return <Dialog width={setWidth} variant={setVariant} />;
};
```

## 注释触发模式

`wrap-hook` 支持用紧邻属性上方的注释，显式指定要使用的 hook。

例如：

```tsx
<Modal
  // useCallback
  onClick={() => console.log(size)}
  // useMemo
  info={buildInfo(size)}
/>
```

修复后会：

- `onClick` 被提取为 `useCallback`
- `info` 被提取为 `useMemo`
- 触发注释会在修复后被移除

如果你只想在写了注释时才触发，可以把对应规则配置成 `commentOnly: true`。

注意你不可在 `onClick` 上注释 `// useMemo`，或者在 `info` 上注释 `// useCallback`。只有函数类型的表达式才能注释为 `useCallback` 类，其余类型则为 `useMemo` 类，下面会详细讲解相关的 `alternates` 配置。

## 配置项

### `wrapHook` 包裹成 `useMemo` 或 `useCallback`

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

常用字段说明：

- `typeDefinitions`: 是否尝试补充泛型类型与类型 import，默认 `true`
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

### `createHook` 创建 `useState` 或 `useRef`

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

常用字段说明：

- `allowAttributes`: 允许自动创建 hook 的属性名，支持字符串和正则配置，默认 `["ref"]`；也可以使用 `["*"]` 表示所有属性，但会影响性能
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

## 适用场景

适合在这些场景中使用：

- 为老代码做渐进式 React 性能清理
- 在组件库或业务组件中批量消除 JSX 内联引用
- 统一把漏写的 `ref` / state hook 补全
- 把一次性的小规模重构收敛到 ESLint 工作流里

## 设计思路

这个项目不是传统意义上的“代码质量检查插件”，而是把 ESLint 变成可落地的轻量级 codemod 引擎：

- 通过 rule 定位可改写的 React 模式
- 通过 autofix 输出结构化改动
- 通过 TypeScript parser services 推断类型与 import
- 通过注释和规则选项控制触发范围

这也是它和 `eslint-plugin-command` 一脉相承的地方：把 ESLint 从“提示问题”扩展成“执行一次性重构”。

## 限制说明

- 当前主要面向 `tsx` / `jsx` 中的 React 函数组件
- 依赖 TypeScript 类型信息时，需要 ESLint 能正确拿到项目类型服务
- 自动生成的依赖数组与类型提取是启发式行为，复杂场景建议人工复核
- 更适合批量执行小型 codemod，而不是替代大型 AST 迁移脚本

## 开发

```bash
bun install
bun test
bun build
```

## License

MIT
