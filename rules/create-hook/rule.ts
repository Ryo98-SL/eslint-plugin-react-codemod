import {
    addIndentationToEachLine,
    CREATE_HOOK_RULE_DEFAULT_OPTIONS,
    type CreateHookRuleOptions,
    createImport,
    createRefHookDeclarationText,
    createRule,
    findParentNode,
    findScopedVariable,
    findTsConfigPath,
    getComponentName,
    getPositionBetweenReturnAndSymbols,
    injectWithImport,
    matchWithExactOrRegex,
    mergeImportUpdateResults,
    processMatchConfig,
    transformFunctionWithNonBlockStatement,
} from "helpers";
import {AST_NODE_TYPES, ESLintUtils} from "@typescript-eslint/utils";
import type {RuleFix} from "@typescript-eslint/utils/ts-eslint";
import type {ImportUpdateResult} from "helpers/types";
import path from "path";
import ts, {EmitHint} from "typescript";
import {TSESTree} from "@typescript-eslint/typescript-estree";
import {createHookAlternates, createStateVariableName, findMatchingHookAlternate, normalizeHookAlternates} from "./hook-config.ts";
import {inferCreateHookType} from "./type-inference.ts";

export const createHook = createRule({
    name: "auto-create-hook",
    meta: {
        type: "suggestion",
        docs: {
            description: "auto create a hook for attributes within your function component",
        },
        fixable: "code",
        defaultOptions: [
            CREATE_HOOK_RULE_DEFAULT_OPTIONS,
        ],
        schema: [{
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
                alternates: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            kind: {
                                type: "string",
                                enum: ["state", "reference"],
                            },
                            stateVariableNamePattern: {
                                type: "string",
                            },
                            isDefaultExport: {
                                type: "boolean",
                            },
                            hookName: {
                                type: "string",
                            },
                            hookModulePath: {
                                type: "string",
                            },
                            matchPattern: {
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
                    },
                },
            },
        }],
        messages: {
            "fast-create-hook": "create a reference hook \"{{hookName}}\" assigned with a variable named \"{{name}}\"",
        },
    },
    create(context) {
        const options: CreateHookRuleOptions = context.options[0]!;
        const allowAllAttributes = !options.allowAttributes || options.allowAttributes.some((attr) => attr === "*");
        const {
            regexpList: allowAttrRegexpList,
            exactSet: allowAttrExactSet,
        } = processMatchConfig(options.allowAttributes || []);

        const normalizedHooks = normalizeHookAlternates(createHookAlternates(options));
        const tsService = ESLintUtils.getParserServices(context);
        const tsChecker = tsService.program.getTypeChecker();
        const sourceFile = tsService.program.getSourceFile(context.filename);
        const shouldAddTypes = options.typeDefinitions !== false && Boolean(sourceFile?.fileName.endsWith("tsx"));

        const sourceCode = context.sourceCode;
        const filename = context.filename;
        const scopeManager = sourceCode.scopeManager!;
        const printer = ts.createPrinter();
        const currentFilePath = context.filename;
        const tsConfigPath = findTsConfigPath(path.dirname(currentFilePath));

        const {
            exactSet: ignoreExactSet,
            regexpList: ignoreRegexpList,
        } = processMatchConfig(options.ignoredComponents || []);

        return {
            JSXAttribute(node) {
                if (
                    !node.value
                    || typeof node.name.name !== "string"
                    || (!allowAllAttributes && !matchWithExactOrRegex(node.name.name, allowAttrExactSet, allowAttrRegexpList))
                ) {
                    return;
                }

                const attrName = node.name.name;
                if (node.value.type !== AST_NODE_TYPES.JSXExpressionContainer) return;

                const expression = node.value.expression;
                if (expression.type === AST_NODE_TYPES.JSXEmptyExpression) return;

                const functionComponentNode = findParentNode(
                    expression.parent,
                    [AST_NODE_TYPES.FunctionExpression, AST_NODE_TYPES.FunctionDeclaration, AST_NODE_TYPES.ArrowFunctionExpression],
                );
                if (!functionComponentNode) {
                    return;
                }

                if (expression.type !== AST_NODE_TYPES.Identifier) {
                    const commentsInside = sourceCode.getCommentsInside(expression);
                    commentsInside.filter((comment) => {
                        return normalizedHooks.some((hook) => hook.commandReg.test(comment.value));
                    });

                    return;
                }

                const componentName = getComponentName(node.parent);
                if (matchWithExactOrRegex(componentName, ignoreExactSet, ignoreRegexpList)) {
                    return;
                }

                const refScope = sourceCode.getScope(expression);
                if (findScopedVariable(expression.name, refScope)) {
                    return;
                }

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

                const hook = findMatchingHookAlternate(expression.name, normalizedHooks);
                const {
                    importUpdates,
                    inferredType,
                } = inferCreateHookType({
                    attrName,
                    componentName,
                    currentFilePath,
                    filename,
                    hook,
                    node,
                    scopeManager,
                    shouldAddTypes,
                    sourceFile,
                    tsChecker,
                    tsConfigPath,
                    tsService,
                });
                pushImport(importUpdates);

                if (sourceFile) {
                    pushImport(createImport(hook.hookName, hook.hookModulePath, hook.isDefaultExport, sourceFile, tsService.program));
                }

                const stateVariableName = createStateVariableName(expression.name, hook);
                const {
                    text: declarationText,
                    variableStatement,
                } = createRefHookDeclarationText(
                    hook.hookName,
                    hook.kind,
                    expression.name,
                    stateVariableName,
                    inferredType,
                    printer,
                    sourceFile,
                    tsChecker,
                );

                context.report({
                    node,
                    messageId: "fast-create-hook",
                    data: {name: expression.name, hookName: hook.hookName},
                    fix: (fixer) => {
                        const fixes: RuleFix[] = [];
                        injectWithImport(fixer, fixes, tsService, printer, importUpdateResults, sourceFile);

                        if (functionComponentNode.body.type === AST_NODE_TYPES.BlockStatement) {
                            const {
                                insertPosition,
                                indent,
                            } = getPositionBetweenReturnAndSymbols(
                                functionComponentNode.body,
                                [],
                                tsService,
                            );

                            fixes.push(fixer.insertTextAfterRange(
                                [insertPosition, insertPosition],
                                addIndentationToEachLine(declarationText, indent),
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
                    },
                });
            },
        };
    },
});
