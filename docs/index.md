---
layout: home

hero:
  name: ESLint Plugin
  text: React Codemod
  tagline: Turn repetitive React refactors into lightweight codemods.
  image:
    src: /logo.svg
    alt: eslint-plugin-react-codemod
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View Examples
      link: /examples

features:
  - title: Getting Started
    details: Install the plugin, wire it into Flat Config, and run the first autofix pass in minutes.
    link: /guide/getting-started
  - title: Configuration
    details: Tune `wrapHook` and `createHook` to match your components, naming conventions, and hook preferences.
    link: /guide/configuration
  - title: Examples
    details: See before-and-after examples for wrapping unstable JSX values and generating missing hooks.
    link: /examples
---

## Examples

### Wrap inline JSX values

::: code-group

```tsx [Before]
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

```tsx [After]
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

### Create missing hooks

::: code-group

```tsx [Before]
import { Dialog } from "./Dialog";

const Demo = () => <Dialog ref={dialogRef} width={setWidth} />;
```

```tsx [After]
import { Dialog, type DialogAPI } from "./Dialog";
import { useRef, useState } from "react";

const Demo = () => {
  const dialogRef = useRef<DialogAPI>(null);
  const [width, setWidth] = useState<Parameters<typeof Dialog>[0]["width"] | null>(null);

  return <Dialog ref={dialogRef} width={setWidth} />;
};
```

:::

More examples are available in [Examples](/examples).
