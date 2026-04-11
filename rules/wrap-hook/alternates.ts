import type {WrapAlternate, WrapHookOptions} from "helpers";
import type {NormalizedMemoAlternate, WrapHookConfigMap} from "./types.ts";

const createHookRegExp = (hookName: string) => {
    return new RegExp(`^\\s*(${hookName})`);
};

export const normalizeAlternates = (alternates?: WrapAlternate[]) => {
    if (!alternates) return [];

    return alternates.map<NormalizedMemoAlternate>((alternate) => {
        return {
            ...alternate,
            regExp: createHookRegExp(alternate.hookName),
        };
    });
};

export const createWrapHookConfig = (options: WrapHookOptions = {}): WrapHookConfigMap => {
    return {
        useMemo: {
            prefer: "useMemo",
            commentOnly: false,
            ...options.useMemo,
            alternates: [
                {
                    hookName: "useMemo",
                    hookModulePath: "react",
                    withDepList: true,
                    isDefaultExport: false,
                },
                ...(options.useMemo?.alternates || []),
            ],
        },
        useCallback: {
            prefer: "useCallback",
            commentOnly: false,
            ...options.useCallback,
            alternates: [
                {
                    hookName: "useCallback",
                    hookModulePath: "react",
                    withDepList: true,
                    isDefaultExport: false,
                },
                ...(options.useCallback?.alternates || []),
            ],
        },
    };
};

export const createNormalizedHookConfig = (hookConfig: WrapHookConfigMap) => {
    return {
        useMemo: normalizeAlternates(hookConfig.useMemo.alternates),
        useCallback: normalizeAlternates(hookConfig.useCallback.alternates),
    };
};
