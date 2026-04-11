# eslint-plugin-react-codemod

English | [简体中文](https://github.com/Ryo98-SL/eslint-plugin-react-codemod/blob/main/README.zh-CN.md)

A React codemod tool built on top of ESLint autofix. Inspired by [eslint-plugin-command](https://github.com/antfu/eslint-plugin-command)

Docs: [ryo98-sl.github.io/eslint-plugin-react-codemod](https://ryo98-sl.github.io/eslint-plugin-react-codemod/)

It focuses on repetitive React refactors:

- Wrap unstable JSX values with `useMemo` or `useCallback`
- Create missing `useRef` and `useState` declarations from JSX usage
- Generate related TypeScript types and imports when possible

This plugin targets ESLint Flat Config and expects your project to already use `typescript`.

## Installation

```bash
pnpm add -D eslint-plugin-react-codemod
```

## Quick Start

```ts
// eslint.config.js

import reactCodemod from "eslint-plugin-react-codemod";

export default [
  reactCodemod(),
];
```

<br />

Then use your editor's ESLint fix suggestions to apply fixes.

Or run:

```bash
eslint Foo.tsx --fix
```

For full examples, configuration, and bilingual docs:

- English docs: [site](https://ryo98-sl.github.io/eslint-plugin-react-codemod/)
- 简体中文文档: [站点](https://ryo98-sl.github.io/eslint-plugin-react-codemod/zh/)

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
