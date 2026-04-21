# eslint-plugin-react-codemod

[English](https://github.com/Ryo98-SL/eslint-plugin-react-codemod/blob/main/README.md) | 简体中文

一个基于 ESLint 自动修复能力实现的 React codemod 工具。灵感来自于[eslint-plugin-command](https://github.com/antfu/eslint-plugin-command)。

文档站：[ryo98-sl.github.io/eslint-plugin-react-codemod](https://ryo98-sl.github.io/eslint-plugin-react-codemod/)

它专注解决几类重复性的 React 重构：

- 把不稳定的 JSX 值包装成 `useMemo` 或 `useCallback`
- 根据 JSX 使用场景自动创建 `useRef` 和 `useState`
- 在可推断时补充相关 TypeScript 类型和 import
- 为 `ahooks`、`Radix`、`jotai`、`MUI` 等常见 React 技术栈提供可复用 preset
- 支持通过 `// useMemo`、`// useRef`、`// ignore` 等邻近注释控制 codemod

这个插件面向 ESLint Flat Config，并假设你的项目已经使用 `typescript`。

## 安装

```bash
pnpm add -D eslint-plugin-react-codemod
```

## 快速开始

```ts
// eslint.config.js

import reactCodemod from "eslint-plugin-react-codemod";

export default [
  reactCodemod(),
];
```

也可以直接组合官方 preset：

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

你也可以通过注释指令强制或跳过某个 JSX prop：

```tsx
<Modal
  // ignore
  onClose={() => console.log(size)}
  // useCallback
  onClick={() => console.log(size)}
/>
```

默认情况下，当检测到 `CI=true`、`CI=1` 或 `NODE_ENV=production` 时，`reactCodemod()` 会关闭所有 rule，避免在生产类环境中误执行 codemod。你仍然可以显式手动开启：

```ts
import reactCodemod from "eslint-plugin-react-codemod";

export default [
  reactCodemod({
    wrapHook: ["warn"],
    createHook: ["warn"],
  }),
];
```

你可以直接利用编辑器的 ESLint 修复建议来完成代码修改。

或者执行：

```bash
eslint . --fix
```

完整示例、配置项和双语文档请查看：

- English docs: [site](https://ryo98-sl.github.io/eslint-plugin-react-codemod/)
- 简体中文文档: [站点](https://ryo98-sl.github.io/eslint-plugin-react-codemod/zh/)

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
