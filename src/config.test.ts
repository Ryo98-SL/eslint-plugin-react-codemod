import {afterEach, describe, expect, test} from "vitest";
import reactCodemod, {compose, presets} from "./index.ts";

const ORIGINAL_CI = process.env.CI;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

afterEach(() => {
    if (ORIGINAL_CI === undefined) {
        delete process.env.CI;
    } else {
        process.env.CI = ORIGINAL_CI;
    }

    if (ORIGINAL_NODE_ENV === undefined) {
        delete process.env.NODE_ENV;
    } else {
        process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    }
});

describe("reactCodemod env defaults", () => {
    test("defaults to warn outside CI and production", () => {
        process.env.CI = "";
        process.env.NODE_ENV = "development";

        const config = reactCodemod();

        expect(config.rules?.["react-codemod/wrap-hook"]).toEqual(["warn"]);
        expect(config.rules?.["react-codemod/create-hook"]).toEqual(["warn"]);
    });

    test("defaults to off in CI", () => {
        process.env.CI = "true";
        process.env.NODE_ENV = "test";

        const config = reactCodemod();

        expect(config.rules?.["react-codemod/wrap-hook"]).toEqual(["off"]);
        expect(config.rules?.["react-codemod/create-hook"]).toEqual(["off"]);
    });

    test("allows manual enablement in CI or production", () => {
        process.env.CI = "1";
        process.env.NODE_ENV = "production";

        const config = reactCodemod({
            wrapHook: ["warn"],
            createHook: ["error"],
        });

        expect(config.rules?.["react-codemod/wrap-hook"]).toEqual(["warn"]);
        expect(config.rules?.["react-codemod/create-hook"]).toEqual(["error"]);
    });
});

describe("reactCodemod presets", () => {
    test("exposes official presets on the default export", () => {
        expect(typeof reactCodemod.presets.ahooks).toBe("function");
        expect(typeof reactCodemod.presets.mui).toBe("function");
        expect(typeof reactCodemod.presets.radix).toBe("function");
        expect(typeof reactCodemod.presets.jotai).toBe("function");
    });

    test("composes ahooks preset with user overrides", () => {
        const config = reactCodemod(compose(
            presets.ahooks(),
            {
                wrapHook: ["error", {
                    allowAttributes: ["onClick"],
                    useMemo: {
                        commentOnly: true,
                    },
                }],
            },
        ));

        expect(config.rules?.["react-codemod/wrap-hook"]).toEqual([
            "error",
            {
                checkFunction: true,
                checkArray: true,
                checkReturnValueOfCalling: true,
                checkNewExpression: true,
                checkRegExp: true,
                allowAttributes: ["onClick"],
                ignoredComponents: ["^[a-z][^.]*$"],
                typeDefinitions: true,
                declarationsPosition: "end",
                useMemo: {
                    prefer: "useCreation",
                    commentOnly: true,
                    alternates: [
                        {
                            hookName: "useCreation",
                            hookModulePath: "ahooks",
                            isDefaultExport: false,
                            withDepList: true,
                        },
                    ],
                },
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
            },
        ]);
    });

    test("materializes wrap-hook defaults when composing presets", () => {
        const options = compose(
            presets.ahooks(),
        );

        expect(options.wrapHook).toEqual([
            "warn",
            expect.objectContaining({
                allowAttributes: ["*"],
                ignoredComponents: ["^[a-z][^.]*$"],
                checkFunction: true,
                checkArray: true,
                checkReturnValueOfCalling: true,
                checkNewExpression: true,
                checkRegExp: true,
                typeDefinitions: true,
                declarationsPosition: "end",
            }),
        ]);
    });

    test("composes create-hook presets by merging alternates and allowAttributes", () => {
        const options = compose(
            presets.radix(),
            presets.jotai(),
        );

        expect(options.createHook).toEqual([
            "warn",
            {
                allowAttributes: ["*"],
                ignoredComponents: [],
                typeDefinitions: true,
                alternates: [
                    {
                        kind: "reference",
                        hookName: "useComposedRef",
                        hookModulePath: "@radix-ui/react-compose-refs",
                        isDefaultExport: false,
                        matchPattern: "^composedRef$",
                    },
                    {
                        kind: "state",
                        hookName: "useAtom",
                        hookModulePath: "jotai",
                        isDefaultExport: false,
                        matchPattern: "^set(\\w+)",
                        stateVariableNamePattern: "$1",
                    },
                ],
            },
        ]);
    });
});
