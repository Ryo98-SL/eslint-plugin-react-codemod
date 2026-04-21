# 效果示例

## Flat Config 接入

```ts
import reactCodemod from "eslint-plugin-react-codemod";

export default [
  reactCodemod(),
];
```

## 执行自动修复

```bash
eslint "**/*.tsx" --fix
```

## 常见重构

### 包装不稳定值

```tsx
<Modal
  info={{ size: 10, backgroundColor: props.backgroundColor }}
  onClick={() => {
    console.log(props.text);
  }}
/>
```

修复后：

```tsx
const modalInfo = useMemo(
  () => ({ size: 10, backgroundColor: props.backgroundColor }),
  [props.backgroundColor],
);

const handleModalClick = useCallback(() => {
  console.log(props.text);
}, [props.text, props]);

return <Modal info={modalInfo} onClick={handleModalClick} />;
```

### 自动创建 `useRef`

```tsx
import { Dialog } from "./Dialog";

const Demo = () => <Dialog ref={dialogRef} />;
```

修复后：

```tsx
import { Dialog, type DialogAPI } from "./Dialog";
import { useRef } from "react";

const Demo = () => {
  const dialogRef = useRef<DialogAPI>(null);
  return <Dialog ref={dialogRef} />;
};
```

### 自动创建 `useState`

```tsx
import { Dialog } from "./Dialog";

const Demo = () => <Dialog width={setWidth} variant={setVariant} />;
```

修复后：

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

两条 rule 都支持在 JSX prop 上方通过注释控制行为。

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

使用 `// ignore` 可以跳过某个 prop：

```tsx
<Modal
  // ignore
  onClose={() => console.log(size)}
/>
```

`create-hook` 也可以通过注释显式指定 hook：

```tsx
<Dialog
  // useRef
  ref={dialogRef}
  // useState
  width={setWidth}
/>
```

如果团队希望使用项目级命名空间，可以配置 `commentDirectives.prefix`，然后使用 `prefix:command` 注释。短命令仍然会兼容。

```ts
reactCodemod({
  wrapHook: ["warn", { commentDirectives: { prefix: "react-codemod" } }],
  createHook: ["warn", { commentDirectives: { prefix: "react-codemod" } }],
});
```

```tsx
<Modal
  // react-codemod:ignore
  onClose={() => console.log(size)}
  // react-codemod:useMemo
  info={buildInfo(size)}
/>
```
