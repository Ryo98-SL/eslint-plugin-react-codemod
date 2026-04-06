import {ReactNode, useState} from "react";


function EarlyReturn(props: { error: any }) {

    const [count, setCount] = useState(1);

    if(props.error) {
        return <span>error: {typeof props.error === 'string' ? props.error : 'toString' in props.error ? JSON.stringify(props.error) : 'unknown error'}</span>
    }

    return <Button
        /// useMemoizedFn
        onClick={() => setCount(count + 1)}
        style={{padding: '10px'}}
    >
        {count}
    </Button>
}

const Button: React.FC<{children: ReactNode, onClick: () => void, style: object}> = (props) => {

    return <button onClick={props.onClick} style={props.style}>{props.children}</button>
}