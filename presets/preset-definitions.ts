import type {ReactCodemodOptions} from "./types.ts";

export const reactCodemodPresets = {
    ahooks(): ReactCodemodOptions {
        return {
            wrapHook: ["warn", {
                useCallback: {
                    prefer: "useMemoizedFn",
                    alternates: [
                        {
                            hookName: "useMemoizedFn",
                            hookModulePath: "ahooks",
                            isDefaultExport: false,
                            withDepList: false,
                        },
                    ],
                },
                useMemo: {
                    prefer: "useCreation",
                    alternates: [
                        {
                            hookName: "useCreation",
                            hookModulePath: "ahooks",
                            isDefaultExport: false,
                            withDepList: true,
                        },
                    ],
                },
            }],
        };
    },
    mui(): ReactCodemodOptions {
        return {
            wrapHook: ["warn", {
                allowAttributes: [
                    "sx",
                    "slotProps",
                    "componentsProps",
                ],
            }],
        };
    },
    radix(): ReactCodemodOptions {
        return {
            createHook: ["warn", {
                alternates: [
                    {
                        kind: "reference",
                        hookName: "useComposedRef",
                        hookModulePath: "@radix-ui/react-compose-refs",
                        isDefaultExport: false,
                        matchPattern: "^composedRef$",
                    },
                ],
            }],
        };
    },
    jotai(): ReactCodemodOptions {
        return {
            createHook: ["warn", {
                allowAttributes: ["*"],
                alternates: [
                    {
                        kind: "state",
                        hookName: "useAtom",
                        hookModulePath: "jotai",
                        isDefaultExport: false,
                        matchPattern: "^set(\\w+)",
                        stateVariableNamePattern: "$1",
                    },
                ],
            }],
        };
    },
};
