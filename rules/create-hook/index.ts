import {
    addIndentationToEachLine,
    analyzeTypeAndCreateImports,
    CREATE_HOOK_RULE_DEFAULT_OPTIONS,
    type CreateHookRuleOptions,
    createRule,
    findTsConfigPath,
    getComponentName,
    createRefHookDeclarationText,
    type BaseRefAlternate,
    type HookAlternate,
    matchWithExactOrRegex, processMatchConfig
} from "helpers";
import {AST_NODE_TYPES, ESLintUtils} from "@typescript-eslint/utils";
import type {RuleFix} from "@typescript-eslint/utils/ts-eslint";
import ts, {EmitHint, TypeFlags} from "typescript";
import path from "path";
import {TSESTree} from "@typescript-eslint/typescript-estree";
import type {ImportUpdateResult} from "helpers/types";
import {getPositionBetweenReturnAndSymbols, transformFunctionWithNonBlockStatement} from "helpers";
import {findParentNode, findScopedVariable} from "helpers";
import {createImport, injectWithImport, mergeImportUpdateResults} from "helpers";
import {getTypeNodeForProp} from "helpers";
import {getExtractType} from "helpers";


export const createHook = createRule({
    name: "auto-create-hook",
    meta: {
        type: "suggestion",
        docs: {
            description: "auto create a hook for attributes within your function component",
        },
        fixable: "code",
        defaultOptions: [
            CREATE_HOOK_RULE_DEFAULT_OPTIONS
        ],
        schema: [{
            type: "object",
            properties: {
                allowAttributes: {
                    type: "array",
                    items: {
                        oneOf: [
                            {
                                type: "string"
                            },
                            {
                                type: "object",
                                properties: {
                                    pattern: {type: "string"},
                                    flags: {type: "string"}
                                },
                                required: ["pattern"],
                                additionalProperties: false
                            }
                        ]
                    }
                },
                typeDefinitions: {
                    type: "boolean",
                },
                ignoredComponents: {
                    type: "array",
                    items: {
                        oneOf: [
                            {
                                type: "string"
                            },
                            {
                                type: "object",
                                properties: {
                                    pattern: {type: "string"},
                                    flags: {type: "string"}
                                },
                                required: ["pattern"],
                                additionalProperties: false
                            }
                        ]
                    }
                },
                "alternates": {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            "kind": {
                                type: "string",
                                enum: ["state", "reference"]
                            },
                            stateVariableNamePattern: {
                                type: "string",
                            },
                            "isDefaultExport": {
                                type: "boolean",
                            },
                            "hookName": {
                                type: "string",
                            },
                            "hookModulePath": {
                                type: "string",
                            },
                            "matchPattern": {
                                oneOf: [
                                    {
                                        type: "string"
                                    },
                                    {
                                        type: "object",
                                        properties: {
                                            pattern: {type: "string"},
                                            flags: {type: "string"}
                                        },
                                        required: ["pattern"],
                                        additionalProperties: false
                                    }
                                ]
                            }
                        }
                    }
                }
            }
        }],
        messages: {
            'fast-create-hook': 'create a reference hook "{{hookName}}" assigned with a variable named "{{name}}"',
        }
    },
    create(context) {
        const options: CreateHookRuleOptions = context.options[0]!;


        const allowAllAttributes = !options.allowAttributes || options.allowAttributes.some((attr) => attr === '*');
        const {
            regexpList: allowAttrRegexpList,
            exactSet: allowAttrExactSet
        } = processMatchConfig(options.allowAttributes || []);

        const hooks: HookAlternate[] = [
            {
                hookName: 'useRef',
                matchPattern: "^\\w+Ref",
                isDefaultExport: false,
                hookModulePath: 'react',
                kind: 'reference'
            },
            {
                hookName: 'useState',
                matchPattern: "^set(\\w+)",
                isDefaultExport: false,
                hookModulePath: 'react',
                kind: 'state',
                stateVariableNamePattern: "$1"
            },
            ...(options.alternates || [])
        ];

        const normalizedHooks = hooks.map((hook) => {
            const matchPattern = hook.matchPattern;
            return {
                ...hook,
                commandReg: new RegExp(`-\s+${hook.hookName}`),
                identifierReg: typeof matchPattern === "string" ? new RegExp(matchPattern) : new RegExp(matchPattern.pattern, matchPattern.flags)
            }
        })

        const tsService = ESLintUtils.getParserServices(context);
        const tsChecker = tsService.program.getTypeChecker();
        const sourceFile = tsService.program.getSourceFile(context.filename);

        const shouldAddTypes = options.typeDefinitions !== false && Boolean(sourceFile?.fileName.endsWith('tsx'));


        const sourceCode = context.sourceCode;
        const filename = context.filename;
        const scopeManager = context.sourceCode.scopeManager!
        const printer = ts.createPrinter();
        const currentFilePath = context.filename;
        const tsConfigPath = findTsConfigPath(path.dirname(currentFilePath));

        // Process ignored components config
        const {
            exactSet: ignoreExactSet,
            regexpList: ignoreRegexpList,
        } = processMatchConfig(options.ignoredComponents || []);

        return {
            "JSXAttribute": (node) => {
                if (
                    !node.value ||
                    typeof node.name.name !== 'string' ||
                    (!allowAllAttributes && !matchWithExactOrRegex(node.name.name, allowAttrExactSet, allowAttrRegexpList))
                ) return;


                const attrName = node.name.name;

                if (node.value.type !== AST_NODE_TYPES.JSXExpressionContainer) return;

                const expression = node.value.expression;

                const functionComponentNode = findParentNode(expression.parent, [AST_NODE_TYPES.FunctionExpression, AST_NODE_TYPES.FunctionDeclaration, AST_NODE_TYPES.ArrowFunctionExpression]);
                if (!functionComponentNode) {
                    // not in FC, unnecessary apply the rule.
                    return;
                }

                if (expression.type !== AST_NODE_TYPES.Identifier) {

                    const commentsInside = sourceCode.getCommentsInside(expression);

                    commentsInside.filter((comment) => {
                        return normalizedHooks.some(_hook =>  _hook.commandReg.test(comment.value))

                    })

                    return;
                }

                const jsxElement = node.parent;
                const componentName = getComponentName(jsxElement);
                if (matchWithExactOrRegex(componentName, ignoreExactSet, ignoreRegexpList)) {
                    return;
                }

                const refScope = sourceCode.getScope(expression);
                const found = findScopedVariable(expression.name, refScope);

                if (found) {
                    return;
                }


                let importUpdateResults: ImportUpdateResult[] = [];

                const pushImport = (update: ImportUpdateResult | ImportUpdateResult[]) => {
                    if (sourceFile) {
                        importUpdateResults = mergeImportUpdateResults(importUpdateResults.concat(update), path.dirname(filename), tsChecker, sourceFile);
                    }
                }

                let hook = normalizedHooks[0]!;
                for (const alternate of normalizedHooks) {
                    if (alternate.identifierReg.test(expression.name)) {
                        hook = alternate;
                        break;
                    }
                }

                let inferredType: ts.Type | ts.TypeNode | undefined;

                outer: {if (shouldAddTypes) {
                    const resolvedTypeInfo = getTypeNodeForProp(
                            node,
                            attrName,
                            componentName,
                            true,
                            true,
                            tsService,
                            filename,
                        );

                        if (!resolvedTypeInfo) break outer;


                        if(attrName === 'ref') {
                            // get type argument "T"'s specified type of Ref<T>
                            //@ts-ignore
                            const [typeArgument] = (resolvedTypeInfo.type.origin as ts.UnionType).types.filter(t => !(t.flags & TypeFlags.Undefined) && !(t.flags & TypeFlags.Null));

                            if (!typeArgument) {
                                return;
                            }


                            inferredType = typeArgument.aliasTypeArguments?.[0];
                        } else {
                            inferredType = resolvedTypeInfo.type;
                        }


                        if(!inferredType) break outer;

                        const {
                            results: importUpdates,
                            scene: importScene
                        } = analyzeTypeAndCreateImports(inferredType, tsService, tsChecker, sourceFile!, tsService.program, scopeManager, currentFilePath, tsConfigPath, {resolveToRelativePath: true});
                        pushImport(importUpdates);

                        const typeHasImported = importScene !== 'imported';
                        if(!importUpdateResults.length && resolvedTypeInfo && typeHasImported && shouldAddTypes) {
                            inferredType = getExtractType(componentName, attrName, inferredType, hook.hookName, resolvedTypeInfo, tsService, tsChecker);
                        }
                }}

                pushImport(createImport(hook.hookName, hook.hookModulePath, hook.isDefaultExport, sourceFile!, tsService.program));

                let stateVariableName: string | undefined;
                if (hook.kind === 'state') {
                    /**
                     * If hook config kind is "state", need to apply special process to get the name of variable,
                     * example:
                     * "setAnchor".replace(
                     *    new RegExp("set(\\w)"),
                     *    "$1"
                     * ) //"Anchor"
                     * .replace(/^./, c => c.toLowerCase()) // "anchor"
                     *
                     */
                    stateVariableName = expression.name
                        .replace(
                            hook.identifierReg,
                            hook.stateVariableNamePattern
                        )
                        .replace(/^./, c => c.toLowerCase());
                }

                const {
                    text: declarationText,
                    variableStatement
                } = createRefHookDeclarationText(hook.hookName, hook.kind, expression.name, stateVariableName, inferredType, printer, sourceFile, tsChecker);

                context.report({
                    node,
                    messageId: 'fast-create-hook',
                    data: {name: expression.name, hookName: hook.hookName},
                    fix: (fixer) => {
                        const fixes: RuleFix[] = [];
                        injectWithImport(fixer, fixes, tsService, printer, importUpdateResults, sourceFile);


                        if (functionComponentNode.body.type === AST_NODE_TYPES.BlockStatement) {

                            const {
                                insertPosition,
                                indent
                            } = getPositionBetweenReturnAndSymbols(
                                functionComponentNode.body,
                                [],
                                tsService
                            )

                            fixes.push(fixer.insertTextAfterRange([insertPosition, insertPosition],
                                addIndentationToEachLine(declarationText, indent)
                            ));

                        } else {
                            const arrowFunction = transformFunctionWithNonBlockStatement(
                                functionComponentNode as TSESTree.ArrowFunctionExpression,
                                tsService,
                                variableStatement,
                            )

                            fixes.push(
                                fixer.replaceText(functionComponentNode, printer.printNode(EmitHint.Expression, arrowFunction, sourceFile!))
                            )
                        }


                        return fixes
                    }
                });

            },
        }
    }
})
