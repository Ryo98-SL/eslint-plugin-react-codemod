import {
    addIndentationToEachLine,
    analyzeTypeAndCreateImports,
    createConstDeclarationText,
    createImport,
    createMemoCallbackHookDeclarationText,
    createRule,
    findEndInsertPosition,
    findParentNode,
    findReferenceUsagesInScope,
    findStartInsertPosition,
    findTsConfigPath,
    generateVariableName,
    getComponentName,
    getExtractType,
    getPositionBetweenReturnAndSymbols,
    getTypeNodeForProp,
    injectWithImport,
    matchWithExactOrRegex,
    mergeImportUpdateResults,
    processMatchConfig,
    transformFunctionWithNonBlockStatement,
    type FixScene,
    type ImportUpdateResult,
    type MutableArray,
    type WrapAlternate,
    type WrapHookOptions,
    WRAP_HOOK_RULE_DEFAULT_OPTIONS,
} from "helpers";
import {AST_NODE_TYPES, ESLintUtils} from "@typescript-eslint/utils";
import type {RuleFix, RuleFixer} from "@typescript-eslint/utils/ts-eslint";
import {TSESTree} from "@typescript-eslint/typescript-estree";
import path from "path";
import ts, {EmitHint} from "typescript";
import {HOOK_CONFIG_SHAPE} from "helpers/constants.ts";
import {createNormalizedHookConfig, createWrapHookConfig} from "./alternates.ts";
import {
    getComponentScopedReferences,
    getHookDependencyReferences,
    normalizeReferenceUsages,
} from "./dependencies.ts";
import {getBaseHookNameForExpression, isSupportedWrapExpression} from "./expressions.ts";

export const wrapHook = createRule({
    name: "wrap-hook",
    meta: {
        type: "suggestion",
        docs: {
            description: "Prevent inline object literals in React JSX props and add proper type definitions",
        },
        fixable: "code",
        messages: {
            noInline: "Avoid to use inline value for {{type}}'s {{propName}}, in order to prevent redundant re-render",
            fixWithUseHook: "Use \"const {{name}} = {{hookName}}(...)\" to wrap",
            fixWithTopLevelScopeConstant: "Hoist the value to create a top-level variable \"{{name}}\"",
        },
        hasSuggestions: true,
        defaultOptions: [
            WRAP_HOOK_RULE_DEFAULT_OPTIONS,
        ],
        schema: [
            {
                type: "object",
                properties: {
                    allowAttributes: {
                        type: "array",
                        items: {
                            oneOf: [
                                {
                                    type: "string",
                                },
                                {
                                    type: "object",
                                    properties: {
                                        pattern: {type: "string"},
                                        flags: {type: "string"},
                                    },
                                    required: ["pattern"],
                                    additionalProperties: false,
                                },
                            ],
                        },
                    },
                    checkFunction: {
                        type: "boolean",
                    },
                    checkArray: {
                        type: "boolean",
                    },
                    checkReturnValueOfCalling: {
                        type: "boolean",
                    },
                    checkNewExpression: {
                        type: "boolean",
                    },
                    checkRegExp: {
                        type: "boolean",
                    },
                    typeDefinitions: {
                        type: "boolean",
                    },
                    ignoredComponents: {
                        type: "array",
                        items: {
                            oneOf: [
                                {
                                    type: "string",
                                },
                                {
                                    type: "object",
                                    properties: {
                                        pattern: {type: "string"},
                                        flags: {type: "string"},
                                    },
                                    required: ["pattern"],
                                    additionalProperties: false,
                                },
                            ],
                        },
                    },
                    useCallback: {
                        type: "object",
                        properties: HOOK_CONFIG_SHAPE,
                    },
                    useMemo: {
                        type: "object",
                        properties: HOOK_CONFIG_SHAPE,
                    },
                    declarationsPosition: {
                        type: "string",
                        enum: ["start", "end"],
                    },
                },
                additionalProperties: false,
            },
        ],
    },
    create(context) {
        const options: WrapHookOptions = context.options[0] || {};
        const hookConfig = createWrapHookConfig(options);
        const normalizedHookConfig = createNormalizedHookConfig(hookConfig);

        const allowAllAttributes = !options.allowAttributes || options.allowAttributes.some((attr) => attr === "*");
        const {
            exactSet: allowAttrExactSet,
            regexpList: allowAttrRegexpList,
        } = processMatchConfig(options.allowAttributes || []);

        const tsService = ESLintUtils.getParserServices(context);
        const sourceFile = tsService.program.getSourceFile(context.filename);
        const shouldAddTypes = options.typeDefinitions !== false && Boolean(sourceFile?.fileName.endsWith("tsx"));
        const declarationsPosition = options.declarationsPosition || "end";
        const {
            exactSet: ignoredComponentExactSet,
            regexpList: ignoredComponentRegexpList,
        } = processMatchConfig(options.ignoredComponents || []);

        const filename = context.filename;
        const tsChecker = tsService.program.getTypeChecker();
        const scopeManager = context.sourceCode.scopeManager!;
        const sourceCode = context.sourceCode;
        const currentFilePath = context.filename;
        const tsConfigPath = findTsConfigPath(path.dirname(currentFilePath));
        const printer = ts.createPrinter();

        return {
            JSXAttribute(node) {
                if (!node.value || typeof node.name.name !== "string") return;

                const attrName = node.name.name;
                if (!allowAllAttributes && !matchWithExactOrRegex(attrName, allowAttrExactSet, allowAttrRegexpList)) {
                    return;
                }

                if (node.value.type !== AST_NODE_TYPES.JSXExpressionContainer) return;

                const expression = node.value.expression;
                if (expression.type === AST_NODE_TYPES.JSXEmptyExpression) return;
                if (!isSupportedWrapExpression(expression, options)) {
                    return;
                }

                const componentName = getComponentName(node.parent);
                if (matchWithExactOrRegex(componentName, ignoredComponentExactSet, ignoredComponentRegexpList)) {
                    return;
                }

                const tsExpression = tsService.esTreeNodeToTSNodeMap.get(expression) as ts.FunctionExpression | ts.ObjectLiteralExpression;
                const functionComponentNode = findParentNode(
                    expression.parent,
                    [
                        AST_NODE_TYPES.FunctionExpression,
                        AST_NODE_TYPES.FunctionDeclaration,
                        AST_NODE_TYPES.ArrowFunctionExpression,
                    ],
                    (current) => {
                        if (!current.parent) {
                            return false;
                        }

                        return !!findParentNode(current.parent, [AST_NODE_TYPES.JSXExpressionContainer]);
                    },
                );

                if (!functionComponentNode) {
                    return;
                }

                const baseHookName = getBaseHookNameForExpression(expression.type);
                const preferHookName = hookConfig[baseHookName].prefer ?? baseHookName;
                const hookAlternates = normalizedHookConfig[baseHookName];
                let hook: WrapAlternate = hookAlternates[0]!;

                let targetCommentNode: TSESTree.Comment | null = null;
                const addRemoveCommentFix = (fixer: RuleFixer, fixes: RuleFix[], comment?: TSESTree.Comment | null) => {
                    if (!comment) {
                        return;
                    }

                    fixes.push(fixer.remove(comment));
                };

                const commentOnly = hookConfig[baseHookName].commentOnly;
                let matchedCommandComment = false;

                const comments = sourceCode.getCommentsBefore(node);
                const closestComment = comments[comments.length - 1];
                if (closestComment && closestComment.loc.start.line + 1 === node.loc.start.line) {
                    targetCommentNode = closestComment;

                    for (const normalized of hookAlternates) {
                        if (!closestComment.value.match(normalized.regExp)) continue;

                        matchedCommandComment = true;
                        hook = normalized;
                        break;
                    }
                }

                if (!matchedCommandComment) {
                    if (commentOnly) return;

                    if (preferHookName) {
                        for (const hookAlternate of hookAlternates) {
                            if (hookAlternate.hookName !== preferHookName) continue;

                            hook = hookAlternate;
                            break;
                        }
                    }
                }

                const references = normalizeReferenceUsages(
                    findReferenceUsagesInScope(tsService, expression),
                    tsChecker,
                );
                const {
                    componentScopedReferences,
                    isUsingMapCallbackArguments,
                } = getComponentScopedReferences(references, tsService, functionComponentNode);

                if (isUsingMapCallbackArguments) {
                    return;
                }

                const scenes = new Set<FixScene>();
                if (componentScopedReferences.length || matchedCommandComment) {
                    scenes.add("hook");
                } else {
                    scenes.add("top-level-constant");
                    if (baseHookName === "useCallback") {
                        scenes.add("hook");
                    }

                }

                const resolvedTypeInfo = getTypeNodeForProp(
                    node,
                    attrName,
                    componentName,
                    true,
                    shouldAddTypes,
                    tsService,
                    filename,
                );

                let importUpdateResults: ImportUpdateResult[] = [];
                const pushImport = (update: ImportUpdateResult | ImportUpdateResult[]) => {
                    if (sourceFile) {
                        importUpdateResults = mergeImportUpdateResults(
                            importUpdateResults.concat(update),
                            path.dirname(filename),
                            tsChecker,
                            sourceFile,
                        );
                    }
                };

                let attrType: ts.Type | ts.TypeNode | undefined = resolvedTypeInfo?.type;
                let typeHasImported = false;

                if (resolvedTypeInfo && sourceFile) {
                    const {
                        results: importUpdates,
                        scene: importScene,
                    } = analyzeTypeAndCreateImports(
                        resolvedTypeInfo.type,
                        tsService,
                        tsChecker,
                        sourceFile,
                        tsService.program,
                        scopeManager,
                        currentFilePath,
                        tsConfigPath,
                    );
                    typeHasImported = importScene === "imported";
                    pushImport(importUpdates);
                }

                if (!importUpdateResults.length && resolvedTypeInfo && !typeHasImported && shouldAddTypes) {
                    attrType = getExtractType(componentName, attrName, attrType, hook.hookName, resolvedTypeInfo, tsService, tsChecker);
                }

                const programNode = sourceCode.ast;
                const suggestList: MutableArray<Parameters<typeof context.report>[0]["suggest"] & {}> = [];
                type FixFn = Parameters<typeof context.report>[0]["fix"];

                if (scenes.has("hook")) {
                    const beforeCheckDuplicate = baseHookName === "useCallback"
                        ? (name: string) => {
                            const onKeywordIndex = name.indexOf("On");
                            if (onKeywordIndex === -1) {
                                return name;
                            }

                            const digOutOnKeyword = name.slice(0, onKeywordIndex) + name.slice(onKeywordIndex + 2);
                            return `handle${digOutOnKeyword.charAt(0).toUpperCase() + digOutOnKeyword.slice(1)}`;
                        }
                        : undefined;

                    const variableName = generateVariableName(expression, tsService, componentName, attrName, true, beforeCheckDuplicate);

                    const fixFn: FixFn = (fixer) => {
                        const fixes: RuleFix[] = [];
                        if (sourceFile) {
                            pushImport(createImport(hook.hookName, hook.hookModulePath, hook.isDefaultExport, sourceFile, tsService.program));
                        }

                        addRemoveCommentFix(fixer, fixes, targetCommentNode);
                        injectWithImport(fixer, fixes, tsService, printer, importUpdateResults, sourceFile);
                        fixes.push(fixer.replaceText(expression, variableName));

                        const dependencyReferences = hook.withDepList
                            ? getHookDependencyReferences(componentScopedReferences, tsChecker)
                            : [];

                        const {text: hookStatementText, variableStatement} = createMemoCallbackHookDeclarationText(
                            hook.hookName,
                            tsExpression,
                            variableName,
                            attrType,
                            dependencyReferences,
                            !hook.withDepList,
                            printer,
                            sourceFile,
                            tsChecker,
                        );

                        if (functionComponentNode.body.type === AST_NODE_TYPES.BlockStatement) {
                            const {
                                insertPosition,
                                indent,
                            } = getPositionBetweenReturnAndSymbols(
                                functionComponentNode.body,
                                componentScopedReferences,
                                tsService,
                            );

                            fixes.push(fixer.insertTextAfterRange(
                                [insertPosition, insertPosition],
                                addIndentationToEachLine(hookStatementText, indent),
                            ));
                        } else {
                            const arrowFunction = transformFunctionWithNonBlockStatement(
                                functionComponentNode as TSESTree.ArrowFunctionExpression,
                                tsService,
                                variableStatement,
                            );

                            fixes.push(
                                fixer.replaceText(functionComponentNode, printer.printNode(EmitHint.Expression, arrowFunction, sourceFile!)),
                            );
                        }

                        return fixes;
                    };

                    suggestList.push({
                        messageId: "fixWithUseHook",
                        data: {name: variableName, hookName: hook.hookName},
                        fix: fixFn,
                    });
                }

                if (scenes.has("top-level-constant")) {
                    const variableName = generateVariableName(expression, tsService, componentName, attrName, false);

                    const fixFn: FixFn = (fixer) => {
                        const fixes: RuleFix[] = [];
                        addRemoveCommentFix(fixer, fixes, targetCommentNode);
                        injectWithImport(fixer, fixes, tsService, printer, importUpdateResults, sourceFile);
                        fixes.push(fixer.replaceText(expression, variableName));

                        const insertPosition = declarationsPosition === "start"
                            ? findStartInsertPosition(programNode)
                            : findEndInsertPosition(programNode);
                        const {text: declarationText} = createConstDeclarationText(
                            tsExpression,
                            variableName,
                            attrType,
                            printer,
                            sourceFile,
                            tsChecker,
                        );

                        if (declarationsPosition === "start") {
                            const insertAfterNode = sourceCode.getNodeByRangeIndex(insertPosition);
                            if (insertAfterNode) {
                                fixes.push(fixer.insertTextAfter(insertAfterNode, declarationText));
                            }
                        } else {
                            const lastToken = sourceCode.getLastToken(programNode);
                            if (lastToken) {
                                fixes.push(fixer.insertTextAfter(lastToken, declarationText));
                            }
                        }

                        return fixes;
                    };

                    suggestList.push({
                        messageId: "fixWithTopLevelScopeConstant",
                        data: {name: variableName},
                        fix: fixFn,
                    });
                }

                context.report({
                    node,
                    messageId: "noInline",
                    data: {
                        type: expression.type,
                        propName: attrName,
                    },
                    suggest: suggestList,
                    fix: suggestList[0]!.fix,
                });
            },
        };
    },
});
