import { useState, useRef, useEffect, type CSSProperties, useMemo, useCallback } from "react";
import { Modal, type ModalInfoType } from "helpers/test-helper/comps/modal";

const width = '1px';
const size = 10;
const mock = '33';

function NoInlineLiteralObject(props: { text: string }) {
    const [backgroundColor, setBackgroundColor] = useState('#000');

    const {z2: _width} = { z2: 2};
    console.log('width', width);
    
    const divStyle = useMemo<CSSProperties | undefined>(() => { return { height: '3px', backgroundColor, width: _width }; }, [backgroundColor, _width]);
    
    const boxStyle = useMemo<CSSProperties | undefined>(() => { return { width: _width }; }, [_width]);
    
    const handleModalClick = useCallback<(Parameters<typeof Modal>[0]["onClick"]) & Function>(({ count }) => {
        console.log(props.text);
        console.log("=>(in.tsx:17) count", count);
    }, [props.text, props]);
    return <div style={divStyle}>
        <Box style={boxStyle}></Box>
        <Modal info={ModalInfo}
               onClick={handleModalClick}/>
        <div style={divStyle1}></div>
    </div>
}

type StyleType = React.CSSProperties;

function Box(props: { style?: StyleType }) {
    return <div style={props.style}>box</div>
}
const divStyle1: CSSProperties | undefined = { width };
const ModalInfo: ModalInfoType | undefined = { size: 10 };

