import type {WrapHookOptions} from "./types";

export const WRAP_HOOK_RULE_DEFAULT_OPTIONS = <WrapHookOptions>{
    checkFunction: true,
    checkArray: true,
    checkReturnValueOfCalling: true,
    checkNewExpression: true,
    checkRegExp: true,
    ignoredComponents: ["^[a-z][^.]*$"],
    typeDefinitions: true,
    declarationsPosition: 'end',
};