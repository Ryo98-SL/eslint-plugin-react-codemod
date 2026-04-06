import {Modal} from "helpers/test-helper/comps/modal";
import {useCallback, useState} from "react";


function PreferTest() {

    const [size, setSize] = useState(10)

    const innerGenInfo = useCallback((size: number) => {
        return {
            size: size + 20
        }
    }, []);

    return <>
        
        <Modal 
            onClick={() => console.log(size)} 
            onClose={() => console.log(size)}
            info={innerGenInfo(size)}
        />
    </>
}
