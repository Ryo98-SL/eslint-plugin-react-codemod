---
layout: home

hero:
  name: ESLint Plugin
  text: React Codemod
  tagline: 把重复的 React 重构工作简化成可执行的 ESLint Fix。
  image:
    src: /logo.svg
    alt: eslint-plugin-react-codemod
  actions:
    - theme: brand
      text: 快速开始
      link: /zh/guide/getting-started
    - theme: alt
      text: 查看示例
      link: /zh/examples

features:
  - title: 快速开始
    details: 快速完成安装、Flat Config 接入，并执行第一轮自动修复。
    link: /zh/guide/getting-started
  - title: 配置说明
    details: 按你的组件约定、命名方式和 hook 偏好定制 `wrapHook` 与 `createHook`。
    link: /zh/guide/configuration
  - title: 效果示例
    details: 查看 JSX 值包装和缺失 hook 自动生成的前后对比示例。
    link: /zh/examples
---

## 示例

### 包装 JSX 内联值

::: code-group

```tsx [修复前]
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

```tsx [修复后]
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

:::

### 自动创建缺失 hook

::: code-group

```tsx [修复前]
import { Dialog } from "./Dialog";

const Demo = () => <Dialog ref={dialogRef} width={setWidth} />;
```

```tsx [修复后]
import { Dialog, type DialogAPI } from "./Dialog";
import { useRef, useState } from "react";

const Demo = () => {
  const dialogRef = useRef<DialogAPI>(null);
  const [width, setWidth] = useState<Parameters<typeof Dialog>[0]["width"] | null>(null);

  return <Dialog ref={dialogRef} width={setWidth} />;
};
```

:::

更多示例可查看 [效果示例](/zh/examples)。
