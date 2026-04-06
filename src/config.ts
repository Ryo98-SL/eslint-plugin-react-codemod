import {CreateHookRuleOptions, HookPattern, WrapHookConfig, WrapHookOptions} from "../helpers/types";
import type {FlatConfig} from "@typescript-eslint/utils/ts-eslint";
import {BaseConfig} from "./base-config.ts";

type RuleLevel = FlatConfig.RuleLevel;


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
            "react-codemod/wrap-hook": [ options?.wrapHook?.[0] ?? "warn", options?.wrapHook?.[1]],
            "react-codemod/create-hook": [options?.createHook?.[0] ?? "warn", options?.createHook?.[1]],
        }
    }
}

const defineMemoRuleConfig = <H extends `use${string}`, >
(config: WrapHookConfig<H>) => config;


export { reactCodemodConfig, defineMemoRuleConfig };