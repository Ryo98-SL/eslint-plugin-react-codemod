import {AST_NODE_TYPES} from "@typescript-eslint/utils";
import type {TSESTree} from "@typescript-eslint/typescript-estree";
import type {WrapHookOptions} from "helpers";
import type {WrapBaseHookName} from "./types.ts";

export const isSupportedWrapExpression = (
    expression: TSESTree.Expression,
    options: WrapHookOptions,
) => {
    switch (expression.type) {
        case AST_NODE_TYPES.ObjectExpression:
            return true;
        case AST_NODE_TYPES.CallExpression:
            return !!options.checkReturnValueOfCalling;
        case AST_NODE_TYPES.NewExpression:
            return !!options.checkNewExpression;
        case AST_NODE_TYPES.Literal:
            return !!options.checkRegExp && "regex" in expression;
        case AST_NODE_TYPES.ArrayExpression:
            return !!options.checkArray;
        case AST_NODE_TYPES.FunctionExpression:
        case AST_NODE_TYPES.ArrowFunctionExpression:
            return !!options.checkFunction;
        case AST_NODE_TYPES.MemberExpression: {
            const objectType = expression.object.type;
            if (objectType === AST_NODE_TYPES.ObjectExpression) return true;
            if (objectType === AST_NODE_TYPES.NewExpression) return !!options.checkNewExpression;
            if (objectType === AST_NODE_TYPES.ArrayExpression) return !!options.checkArray;

            return (
                (objectType === AST_NODE_TYPES.FunctionExpression || objectType === AST_NODE_TYPES.ArrowFunctionExpression)
                && !!options.checkFunction
            );
        }
        default:
            return false;
    }
};

export const getBaseHookNameForExpression = (
    expressionType: TSESTree.Expression["type"],
): WrapBaseHookName => {
    return (
        expressionType === AST_NODE_TYPES.ObjectExpression
        || expressionType === AST_NODE_TYPES.ArrayExpression
        || expressionType === AST_NODE_TYPES.NewExpression
        || expressionType === AST_NODE_TYPES.CallExpression
        || expressionType === AST_NODE_TYPES.MemberExpression
        || expressionType === AST_NODE_TYPES.Literal
    )
        ? "useMemo"
        : "useCallback";
};
