import { Modal, type ModalInfoType } from "helpers/test-helper/comps/modal";
import { useCallback, useState, useMemo } from "react";


function CommentTest() {

    const [size, setSize] = useState(10)

    const innerGenInfo = useCallback((size: number) => {
        return {
            size: size + 20
        }
    }, []);

    
    const modalInfo = useMemo<ModalInfoType | undefined>(() => { return innerGenInfo(size); }, [innerGenInfo, size]);
    
    const handleModalClick = useCallback<(Parameters<typeof Modal>[0]["onClick"]) & Function>(() => console.log(size), [size]);
    return <>
        
        <Modal 
            
            onClick={handleModalClick} 
            onClose={() => console.log(size)}
            
            info={modalInfo}
        />
    </>
}
