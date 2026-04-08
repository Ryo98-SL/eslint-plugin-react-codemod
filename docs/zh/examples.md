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

`wrap-hook` 支持用紧邻属性上方的注释，显式指定要使用的 hook。

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
