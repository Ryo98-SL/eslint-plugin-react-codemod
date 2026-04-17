import type {FlatConfig} from "@typescript-eslint/utils/ts-eslint";
import type {CreateHookRuleOptions, HookPattern, WrapHookOptions} from "../helpers/types";

type RuleLevel = FlatConfig.RuleLevel;

export type ReactCodemodRuleLevel = RuleLevel;
export type ReactCodemodOptions<H extends HookPattern = HookPattern> = {
    wrapHook?: [RuleLevel, WrapHookOptions<H>] | [RuleLevel],
    createHook?: [RuleLevel, CreateHookRuleOptions] | [RuleLevel],
};
