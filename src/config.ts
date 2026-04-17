import {CreateHookRuleOptions, HookPattern, WrapHookConfig, WrapHookOptions} from "../helpers/types";
import type {FlatConfig} from "@typescript-eslint/utils/ts-eslint";
import {BaseConfig} from "./base-config.ts";
import type {ReactCodemodOptions} from "../presets/index.ts";

type RuleLevel = FlatConfig.RuleLevel;

const isSafeDefaultDisabledEnvironment = () => {
    return process.env.CI === "true" || process.env.CI === "1" || process.env.NODE_ENV === "production";
};

const getDefaultRuleLevel = (): RuleLevel => {
    return isSafeDefaultDisabledEnvironment() ? "off" : "warn";
};

const createRuleEntry = <T>(option?: [RuleLevel, T] | [RuleLevel]): [RuleLevel] | [RuleLevel, T] => {
    const level = option?.[0] ?? getDefaultRuleLevel();

    return option?.length === 1 || option?.[1] === undefined
        ? [level]
        : [level, option[1]];
}


function reactCodemodConfig<H extends HookPattern = HookPattern>(
options?: ReactCodemodOptions<H>
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

const defineConfig = <H extends HookPattern = HookPattern>(config: ReactCodemodOptions<H>) => config;

export type {ReactCodemodOptions, ReactCodemodRuleLevel} from "../presets/index.ts";
export { reactCodemodConfig, defineConfig, defineMemoRuleConfig };
