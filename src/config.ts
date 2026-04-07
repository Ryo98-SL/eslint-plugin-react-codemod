import {CreateHookRuleOptions, HookPattern, WrapHookConfig, WrapHookOptions} from "../helpers/types";
import type {FlatConfig} from "@typescript-eslint/utils/ts-eslint";
import {BaseConfig} from "./base-config.ts";

type RuleLevel = FlatConfig.RuleLevel;

const createRuleEntry = <T>(option?: [RuleLevel, T]): [RuleLevel] | [RuleLevel, T] => {
    const level = option?.[0] ?? "warn";

    return option?.[1] === undefined
        ? [level]
        : [level, option[1]];
}


function reactCodemodConfig<H extends HookPattern = HookPattern>(
options?: {
                                wrapHook?: [RuleLevel, WrapHookOptions<H>],
                                createHook?: [RuleLevel, CreateHookRuleOptions],
                            }
): FlatConfig.Config {

    return {
        ...BaseConfig,
        rules: {
            ...BaseConfig.rules,
            "react-codemod/wrap-hook": createRuleEntry(options?.wrapHook),
            "react-codemod/create-hook": createRuleEntry(options?.createHook),
        }
    }
}

const defineMemoRuleConfig = <H extends `use${string}`, >
(config: WrapHookConfig<H>) => config;


export { reactCodemodConfig, defineMemoRuleConfig };
