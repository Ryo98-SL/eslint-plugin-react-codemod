# Examples

## Flat Config Setup

```ts
import reactCodemod from "eslint-plugin-react-codemod";

export default [
  reactCodemod(),
];
```

## Run Autofix

```bash
eslint "**/*.tsx" --fix
```

## Typical Refactors

### Wrap unstable values

```tsx
<Modal
  info={{ size: 10, backgroundColor: props.backgroundColor }}
  onClick={() => {
    console.log(props.text);
  }}
/>
```

Becomes:

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

### Create missing hooks

```tsx
const Demo = () => <Dialog ref={dialogRef} width={setWidth} />;
```

The rule can generate the missing `useRef` or `useState` declaration based on the identifier pattern and JSX prop context.

### Create `useRef` automatically

```tsx
import { Dialog } from "./Dialog";

const Demo = () => <Dialog ref={dialogRef} />;
```

After fixing:

```tsx
import { Dialog, type DialogAPI } from "./Dialog";
import { useRef } from "react";

const Demo = () => {
  const dialogRef = useRef<DialogAPI>(null);
  return <Dialog ref={dialogRef} />;
};
```

### Create `useState` automatically

```tsx
import { Dialog } from "./Dialog";

const Demo = () => <Dialog width={setWidth} variant={setVariant} />;
```

After fixing:

```tsx
import { Dialog } from "./Dialog";
import { useState } from "react";

const Demo = () => {
  const [width, setWidth] = useState<Parameters<typeof Dialog>[0]["width"] | null>(null);
  const [variant, setVariant] = useState(null);

  return <Dialog width={setWidth} variant={setVariant} />;
};
```

## Comment-Driven Mode

Both rules support command-style comments directly above a prop.

```tsx
<Modal
  // useCallback
  onClick={() => console.log(size)}
  // useMemo
  info={buildInfo(size)}
/>
```

After fixing:

- `onClick` is extracted into `useCallback`
- `info` is extracted into `useMemo`
- the trigger comments are removed automatically

If you only want transformations to run when a comment is present, set `commentOnly: true`.

Use `// ignore` to skip one prop:

```tsx
<Modal
  // ignore
  onClose={() => console.log(size)}
/>
```

`create-hook` can also be guided with hook comments:

```tsx
<Dialog
  // useRef
  ref={dialogRef}
  // useState
  width={setWidth}
/>
```

For teams that want a project-specific namespace, configure `commentDirectives.prefix` and use `prefix:command` comments. Short commands remain supported.

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
