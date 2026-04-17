import {Modal} from "helpers/test-helper/comps/modal";
import {useState} from "react";

function Demo() {
    const [size] = useState(10);

    return <Modal
        info={buildInfo(size)}
        onClick={() => console.log(size)}
    />;
}

function buildInfo(size: number) {
    return {
        size,
    };
}
