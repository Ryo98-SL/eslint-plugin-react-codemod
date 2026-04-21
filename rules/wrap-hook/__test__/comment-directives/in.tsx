import {Modal} from "helpers/test-helper/comps/modal";
import {useCallback, useState} from "react";

function CommentDirectiveTest() {
    const [size] = useState(10);

    const innerGenInfo = useCallback((size: number) => {
        return {
            size: size + 20,
        };
    }, []);

    return <Modal
        // useMemoizedFn
        onClick={() => console.log(size)}
        // ignore
        onClose={() => console.log(size)}
        // react-codemod:useCreation
        info={innerGenInfo(size)}
    />;
}
