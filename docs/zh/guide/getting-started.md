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

<br />

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

## 文档开发

仓库使用 `bun` workspaces。请在项目根目录安装依赖：

```bash
bun install
```

启动 VitePress 开发服务：

```bash
bun run docs:dev
```

构建静态站点：

```bash
bun run docs:build
```

本地预览构建产物：

```bash
bun run docs:preview
```

构建输出目录为 `docs/.vitepress/dist`。

## GitHub Pages 部署

文档站默认部署在 GitHub Pages 项目站点路径：

```txt
/eslint-plugin-react-codemod/
```

对应默认地址：

```txt
https://ryo98-sl.github.io/eslint-plugin-react-codemod/
```

如果仓库名或 GitHub 账号变更，需要同步修改 `docs/.vitepress/config.ts`。
