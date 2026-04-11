import type {HookAlternate} from "helpers";

export type NormalizedHookAlternate = HookAlternate & {
    commandReg: RegExp;
    identifierReg: RegExp;
};
