import type {CreateHookRuleOptions, WrapHookOptions} from "./types";

export const WRAP_HOOK_RULE_DEFAULT_OPTIONS = <WrapHookOptions>{
    checkFunction: true,
    checkArray: true,
    checkReturnValueOfCalling: true,
    checkNewExpression: true,
    checkRegExp: true,
    allowAttributes: ["*"],
    ignoredComponents: ["^[a-z][^.]*$"],
    typeDefinitions: true,
    declarationsPosition: 'end',
};

export const CREATE_HOOK_RULE_DEFAULT_OPTIONS = <CreateHookRuleOptions>{
    typeDefinitions: true,
    ignoredComponents: [],
    alternates: [],
    allowAttributes: ["ref"],
};
