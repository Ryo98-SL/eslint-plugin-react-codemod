import {Dialog} from "helpers/test-helper/comps/dialog.tsx";

const MyFc = () => (
    <Dialog
        // ignore
        ref={ignoredRef}
        // react-codemod:useRef
        width={widthValue}
        // useState
        variant={setVariant}
        // useState
        height={heightValue}
    />
);
