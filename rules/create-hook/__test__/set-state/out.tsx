import { Dialog, type DialogAPI } from "helpers/test-helper/comps/dialog.tsx";
import { type Ref, useState } from "react";

const MyFc = () => {
    const [dialogNode, setDialogNode] = useState<DialogAPI | null>(null);
    
    const [width, setWidth] = useState<Parameters<typeof Dialog>[0]["width"] | null>(null);
    
    const [variant, setVariant] = useState(null);
    return <Dialog ref={setDialogNode} width={setWidth} variant={setVariant}/>;
}