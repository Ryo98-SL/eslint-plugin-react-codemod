import type {CreateHookRuleOptions, HookAlternate} from "helpers";
import type {NormalizedHookAlternate} from "./types.ts";

export const createHookAlternates = (options: CreateHookRuleOptions): HookAlternate[] => {
    return [
        {
            hookName: "useRef",
            matchPattern: "^\\w+Ref",
            isDefaultExport: false,
            hookModulePath: "react",
            kind: "reference",
        },
        {
            hookName: "useState",
            matchPattern: "^set(\\w+)",
            isDefaultExport: false,
            hookModulePath: "react",
            kind: "state",
            stateVariableNamePattern: "$1",
        },
        ...(options.alternates || []),
    ];
};

export const normalizeHookAlternates = (hooks: HookAlternate[]): NormalizedHookAlternate[] => {
    return hooks.map((hook) => {
        const matchPattern = hook.matchPattern;

        return {
            ...hook,
            commandReg: new RegExp(`-\\s+${hook.hookName}`),
            identifierReg: typeof matchPattern === "string"
                ? new RegExp(matchPattern)
                : new RegExp(matchPattern.pattern, matchPattern.flags),
        };
    });
};

export const findMatchingHookAlternate = (
    identifierName: string,
    normalizedHooks: NormalizedHookAlternate[],
) => {
    for (const alternate of normalizedHooks) {
        if (alternate.identifierReg.test(identifierName)) {
            return alternate;
        }
    }

    return normalizedHooks[0]!;
};

export const createStateVariableName = (
    identifierName: string,
    hook: NormalizedHookAlternate,
) => {
    if (hook.kind !== "state") {
        return undefined;
    }

    return identifierName
        .replace(
            hook.identifierReg,
            hook.stateVariableNamePattern,
        )
        .replace(/^./, (char) => char.toLowerCase());
};
