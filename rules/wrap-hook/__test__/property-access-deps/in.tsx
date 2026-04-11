import {Modal} from "helpers/test-helper/comps/modal";
import {useState} from "react";

function Demo(props: { text: string; title: string }) {
    const [count, setCount] = useState(0);

    return <Modal
        onClick={({count: nextCount}) => {
            console.log(props.text);
            console.log(props.title);
            setCount(count + nextCount);
        }}
    />;
}
