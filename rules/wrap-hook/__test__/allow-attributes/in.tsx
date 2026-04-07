import {Modal} from "helpers/test-helper/comps/modal";

function Demo(props: { label: string }) {
    return <Modal
        info={{size: 10}}
        onClick={() => {
            console.log(props.label);
        }}
    />;
}
