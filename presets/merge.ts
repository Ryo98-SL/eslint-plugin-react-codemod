import type {CreateHookRuleOptions, HookPattern, RegExpConfig, WrapHookOptions} from "../helpers/types";
import {CREATE_HOOK_RULE_DEFAULT_OPTIONS, WRAP_HOOK_RULE_DEFAULT_OPTIONS} from "../helpers/default-options.ts";
import type {ReactCodemodOptions, ReactCodemodRuleLevel} from "./types.ts";

type MatchItem = string | RegExpConfig;

const mergeUniqueItems = <T>(...lists: (T[] | undefined)[]) => {
    const seen = new Set<string>();
    const merged: T[] = [];

    for (const list of lists) {
        for (const item of list || []) {
            const key = typeof item === "string" ? item : JSON.stringify(item);
            if (seen.has(key)) {
                continue;
            }

            seen.add(key);
            merged.push(item);
        }
    }

    return merged;
};

const mergeItemsWithDefaultWhenUnset = <T>(
    defaultItems: T[] | undefined,
    ...lists: (T[] | undefined)[]
) => {
    const hasExplicitConfig = lists.some((list) => list !== undefined);

    return hasExplicitConfig
        ? mergeUniqueItems(...lists)
        : mergeUniqueItems(defaultItems);
};

const mergeExplicitItems = <T>(...lists: (T[] | undefined)[]) => {
    const hasExplicitConfig = lists.some((list) => list !== undefined);

    return hasExplicitConfig
        ? mergeUniqueItems(...lists)
        : undefined;
};

const mergeWrapHookOptions = <H extends HookPattern = HookPattern>(
    base: WrapHookOptions<H> = {},
    next: WrapHookOptions<H> = {},
): WrapHookOptions<H> => {
    return {
        ...base,
        ...next,
        allowAttributes: mergeExplicitItems<MatchItem>(base.allowAttributes, next.allowAttributes),
        ignoredComponents: mergeExplicitItems<MatchItem>(base.ignoredComponents, next.ignoredComponents),
        useMemo: {
            ...base.useMemo,
            ...next.useMemo,
            alternates: mergeExplicitItems(base.useMemo?.alternates, next.useMemo?.alternates),
        },
        useCallback: {
            ...base.useCallback,
            ...next.useCallback,
            alternates: mergeExplicitItems(base.useCallback?.alternates, next.useCallback?.alternates),
        },
    };
};

const mergeCreateHookOptions = (
    base: CreateHookRuleOptions = {},
    next: CreateHookRuleOptions = {},
): CreateHookRuleOptions => {
    return {
        ...base,
        ...next,
        allowAttributes: mergeExplicitItems<MatchItem>(base.allowAttributes, next.allowAttributes),
        ignoredComponents: mergeExplicitItems<MatchItem>(base.ignoredComponents, next.ignoredComponents),
        alternates: mergeExplicitItems(base.alternates, next.alternates),
    };
};

const materializeWrapHookDefaults = <H extends HookPattern = HookPattern>(
    options: WrapHookOptions<H>,
): WrapHookOptions<H> => {
    return {
        ...WRAP_HOOK_RULE_DEFAULT_OPTIONS,
        ...options,
        allowAttributes: mergeItemsWithDefaultWhenUnset(
            WRAP_HOOK_RULE_DEFAULT_OPTIONS.allowAttributes,
            options.allowAttributes,
        ),
        ignoredComponents: mergeItemsWithDefaultWhenUnset(
            WRAP_HOOK_RULE_DEFAULT_OPTIONS.ignoredComponents,
            options.ignoredComponents,
        ),
    } as WrapHookOptions<H>;
};

const materializeCreateHookDefaults = (
    options: CreateHookRuleOptions,
): CreateHookRuleOptions => {
    return {
        ...CREATE_HOOK_RULE_DEFAULT_OPTIONS,
        ...options,
        allowAttributes: mergeItemsWithDefaultWhenUnset(
            CREATE_HOOK_RULE_DEFAULT_OPTIONS.allowAttributes,
            options.allowAttributes,
        ),
        ignoredComponents: mergeItemsWithDefaultWhenUnset(
            CREATE_HOOK_RULE_DEFAULT_OPTIONS.ignoredComponents,
            options.ignoredComponents,
        ),
        alternates: mergeItemsWithDefaultWhenUnset(
            CREATE_HOOK_RULE_DEFAULT_OPTIONS.alternates,
            options.alternates,
        ),
    };
};

const mergeRuleEntry = <T>(
    base: [ReactCodemodRuleLevel, T] | [ReactCodemodRuleLevel] | undefined,
    next: [ReactCodemodRuleLevel, T] | [ReactCodemodRuleLevel] | undefined,
    mergeOptions: (base: T | undefined, next: T | undefined) => T | undefined,
) => {
    const level = next?.[0] ?? base?.[0];
    if (!level) {
        return undefined;
    }

    const mergedOptions = mergeOptions(base?.[1], next?.[1]);
    if (mergedOptions === undefined) {
        return [level] as [typeof level];
    }

    return [level, mergedOptions] as [typeof level, T];
};

export const composeReactCodemodOptions = <H extends HookPattern = HookPattern>(
    ...configs: Array<ReactCodemodOptions<H> | undefined>
): ReactCodemodOptions<H> => {
    const merged = configs.reduce<ReactCodemodOptions<H>>((currentMerged, current) => {
        if (!current) {
            return currentMerged;
        }

        return {
            wrapHook: mergeRuleEntry<WrapHookOptions<H>>(currentMerged.wrapHook, current.wrapHook, mergeWrapHookOptions),
            createHook: mergeRuleEntry<CreateHookRuleOptions>(currentMerged.createHook, current.createHook, mergeCreateHookOptions),
        };
    }, {});

    return {
        wrapHook: merged.wrapHook?.length === 2
            ? [merged.wrapHook[0], materializeWrapHookDefaults(merged.wrapHook[1])]
            : merged.wrapHook,
        createHook: merged.createHook?.length === 2
            ? [merged.createHook[0], materializeCreateHookDefaults(merged.createHook[1])]
            : merged.createHook,
    };
};
