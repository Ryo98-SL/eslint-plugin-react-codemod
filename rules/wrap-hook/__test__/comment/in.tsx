import {Modal} from "helpers/test-helper/comps/modal";
import {useCallback, useState} from "react";


function CommentTest() {

    const [size, setSize] = useState(10)

    const innerGenInfo = useCallback((size: number) => {
        return {
            size: size + 20
        }
    }, []);

    return <>
        
        <Modal 
            // useCallback
            onClick={() => console.log(size)} 
            onClose={() => console.log(size)}
            // useMemo
            info={innerGenInfo(size)}
        />
    </>
}
