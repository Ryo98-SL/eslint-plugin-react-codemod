import {AST_NODE_TYPES} from "@typescript-eslint/utils";
import type {TSESTree} from "@typescript-eslint/typescript-estree";
import {
    findParentNode,
    isNodeDescendant,
    type TsService,
} from "helpers";
import ts from "typescript";
import {REF_PATTERN, SET_STATE_TYPE_STRING_PATTERN} from "helpers/constants.ts";
import type {ReferenceUsage} from "./types.ts";

// Drill through wrappers like `(foo)`, `foo as Bar`, `foo!`, and `foo.bar.baz`
// until we reach the root expression that owns the dependency.
const getDependencyRootExpression = (expression: ts.Expression): ts.Expression => {
    if (
        ts.isParenthesizedExpression(expression)
        || ts.isAsExpression(expression)
        || ts.isSatisfiesExpression(expression)
        || ts.isNonNullExpression(expression)
    ) {
        return getDependencyRootExpression(expression.expression);
    }

    if (ts.isPropertyAccessExpression(expression) || ts.isElementAccessExpression(expression)) {
        return getDependencyRootExpression(expression.expression);
    }

    return expression;
};

export const normalizeReferenceUsages = (
    references: ReferenceUsage[],
    tsChecker: ts.TypeChecker,
) => {
    // Keep only the outermost property access nodes so `props.user.name`
    // is tracked as one dependency candidate instead of three nested ones.
    const propertyAccessNodes = references
        .map((reference) => reference.node)
        .filter(ts.isPropertyAccessExpression)
        .filter((node, index, nodes) => {
            return !nodes.some((otherNode, otherIndex) => {
                return index !== otherIndex && isNodeDescendant(node, otherNode);
            });
        });

    // For `props.text`, we want `[props.text]`, not `[props.text, props]`.
    // Only the root identifier of a property chain should be suppressed.
    // This intentionally does not suppress identifiers used deeper inside
    // other expressions such as `new Foo({ value: size }).bar`.
    const suppressedIdentifierNodes = new Set<ts.Node>(
        propertyAccessNodes.flatMap((node) => {
            const rootExpression = getDependencyRootExpression(node.expression);
            return ts.isIdentifier(rootExpression) ? [rootExpression] : [];
        }),
    );

    const seen = new Set<string>();

    return references.flatMap((reference) => {
        const {node} = reference;

        if (ts.isIdentifier(node) && suppressedIdentifierNodes.has(node)) {
            return [];
        }

        // If we already keep the outer property access node, nested property
        // accesses inside it should not be emitted as separate dependencies.
        if (ts.isPropertyAccessExpression(node) && propertyAccessNodes.some((propertyAccessNode) => propertyAccessNode !== node && isNodeDescendant(node, propertyAccessNode))) {
            return [];
        }

        let normalizedSymbol = reference.symbol;
        if (ts.isPropertyAccessExpression(node)) {
            // Dependency arrays should still render the full property access
            // expression, but symbol-level checks such as "is this a ref?"
            // should use the root binding (`props`, `fooRef`, etc.).
            const rootExpression = getDependencyRootExpression(node.expression);
            if (ts.isIdentifier(rootExpression)) {
                normalizedSymbol = tsChecker.getSymbolAtLocation(rootExpression) ?? normalizedSymbol;
            }
        }

        const key = `${ts.isPropertyAccessExpression(node) ? "property" : "node"}:${node.getText()}`;
        if (seen.has(key)) {
            return [];
        }

        seen.add(key);

        return [{
            symbol: normalizedSymbol,
            node,
        }];
    });
};

export const getComponentScopedReferences = (
    references: ReferenceUsage[],
    tsService: TsService,
    functionComponentNode: TSESTree.ArrowFunctionExpression | TSESTree.FunctionDeclaration | TSESTree.FunctionExpression,
) => {
    // References coming from iterator callbacks such as `list.map((item) => ...)`
    // are not safe to hoist into component-level hooks, because those bindings
    // only exist inside the nested callback scope.
    let isUsingMapCallbackArguments = false;

    const componentScopedReferences = references.filter(({symbol, node: referenceNode}) => {
        if (!symbol.valueDeclaration || isUsingMapCallbackArguments) return false;

        const symbolNode = tsService.tsNodeToESTreeNodeMap.get(symbol.valueDeclaration);
        const foundFunctionNode = findParentNode(
            symbolNode,
            [AST_NODE_TYPES.FunctionDeclaration, AST_NODE_TYPES.ArrowFunctionExpression],
        );

        if (foundFunctionNode) {
            isUsingMapCallbackArguments = isNodeDescendant(
                tsService.esTreeNodeToTSNodeMap.get(foundFunctionNode),
                tsService.esTreeNodeToTSNodeMap.get(functionComponentNode),
            );
        }

        return foundFunctionNode === functionComponentNode;
    });

    return {
        componentScopedReferences,
        isUsingMapCallbackArguments,
    };
};

export const getHookDependencyReferences = (
    references: ReferenceUsage[],
    tsChecker: ts.TypeChecker,
) => {
    return references.filter((reference) => {
        const refType = tsChecker.getTypeOfSymbol(reference.symbol);
        const typeString = tsChecker.typeToString(refType);
        const isSetStateFunction = SET_STATE_TYPE_STRING_PATTERN.test(typeString);
        const isRefObject = REF_PATTERN.test(typeString);

        return !isSetStateFunction && !isRefObject;
    });
};
