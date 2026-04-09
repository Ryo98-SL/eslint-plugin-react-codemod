# 快速开始

## 安装

请先确保项目已经具备 ESLint 9 和 TypeScript，再安装插件：

```bash
pnpm add -D eslint-plugin-react-codemod
```

这个插件面向 ESLint Flat Config。

```ts
// eslint.config.js

import reactCodemod from "eslint-plugin-react-codemod";

export default [
  reactCodemod(),
];
```

你可以直接利用编辑器的 ESLint 修复建议来完成代码修改。

或者执行：

```bash
eslint App.tsx --fix
```

## 配置

如果你希望插件识别项目里已经在用的 hook 替代实现，建议先配置 `alternates`；如果希望自动修复时优先使用某个 hook 名，再通过 `prefer` 明确指定。

例如项目里已经使用 `ahooks`：

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

如果你需要根据变量命名约定生成自定义 hook，也可以在 `createHook` 里配置 `alternates`。更完整的字段说明见 `配置说明` 章节。

## 适用场景

这个插件适合：

- 为老代码做渐进式 React 性能清理
- 在组件库或业务组件中批量消除 JSX 内联引用
- 自动补齐缺失的 `ref` / state hook 声明
- 把一次性的小规模重构收敛到 ESLint 工作流里

## 限制说明

- 当前主要面向 `tsx` / `jsx` 中的 React 函数组件
- 依赖 TypeScript 类型信息时，需要 ESLint 能正确拿到项目类型服务
- 自动生成的依赖数组与类型提取是启发式行为，复杂场景建议人工复核
- 更适合批量执行小型 codemod，而不是替代大型 AST 迁移脚本
