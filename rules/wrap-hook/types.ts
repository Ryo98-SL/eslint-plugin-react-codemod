import type ts from "typescript";
import type {WrapAlternate, WrapHookConfig} from "helpers";

export type WrapBaseHookName = "useMemo" | "useCallback";

export type ReferenceUsage = {
    symbol: ts.Symbol;
    node: ts.Node;
};

export interface NormalizedMemoAlternate extends WrapAlternate {
    regExp: RegExp;
}

export type WrapHookConfigMap = Record<WrapBaseHookName, WrapHookConfig>;
