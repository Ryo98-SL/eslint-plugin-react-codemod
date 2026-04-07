import {
    addIndentationToEachLine,
    analyzeTypeAndCreateImports,
    createImport,
    createRule,
    findEndInsertPosition,
    findParentNode,
    findReferenceUsagesInScope,
    findStartInsertPosition,
    findTsConfigPath,
    type FixScene,
    generateVariableName,
    getComponentName,
    createConstDeclarationText,
    createMemoCallbackHookDeclarationText,
    getPositionBetweenReturnAndSymbols,
    type ImportUpdateResult,
    injectWithImport,
    type WrapAlternate,
    mergeImportUpdateResults,
    type MutableArray,
    processMatchConfig,
    matchWithExactOrRegex,
    transformFunctionWithNonBlockStatement,
    type WrapHookConfig,
    type WrapHookOptions,
    WRAP_HOOK_RULE_DEFAULT_OPTIONS,
    getTypeNodeForProp, isNodeDescendant,
    getExtractType
} from "helpers";
import {AST_NODE_TYPES, ESLintUtils} from "@typescript-eslint/utils";
import ts, {EmitHint} from "typescript";
import path from "path";
import type {RuleFix, RuleFixer} from "@typescript-eslint/utils/ts-eslint";
import {TSESTree} from "@typescript-eslint/typescript-estree";


import {HOOK_CONFIG_SHAPE, REF_PATTERN, SET_STATE_TYPE_STRING_PATTERN} from "helpers/constants.ts";

export const wrapHook = createRule({
    name: 'wrap-hook',
    meta: {
        defaultOptions: [
            WRAP_HOOK_RULE_DEFAULT_OPTIONS
        ],
        type: "suggestion",
        docs: {
            description: "Prevent inline object literals in React JSX props and add proper type definitions",
        },
        fixable: "code",
        messages: {
            'noInline': 'Avoid to use inline value for {{type}}\'s {{propName}}, in order to prevent redundant re-render',
            'fixWithUseHook': 'Use "const {{name}} = {{hookName}}(...)" to wrap',
            'fixWithTopLevelScopeConstant': 'Hoist the value to create a top-level variable "{{name}}"'
        },
        hasSuggestions: true,

        schema: [
            {
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
                    useCallback: {
                        type: "object",
                        properties: HOOK_CONFIG_SHAPE
                    },
                    useMemo: {
                        type: "object",
                        properties: HOOK_CONFIG_SHAPE
                    },
                    declarationsPosition: {
                        type: "string",
                        enum: ["start", "end"],
                    }
                },
                additionalProperties: false
            }
        ],
    },
    defaultOptions: [], // The type for this option is put in the wrong place by @typescript-eslint/utils, ignore it.
    create(context) {

        // Get options
        const options: WrapHookOptions = context.options[0] || {};

        const hookConfig: Record<'useMemo' | 'useCallback', WrapHookConfig>  = {
            useMemo: {
                prefer: 'useMemo',
                commentOnly: false,
                ...options?.useMemo,
                alternates:[
                    {
                        hookName: 'useMemo',
                        hookModulePath: 'react',
                        withDepList: true,
                        isDefaultExport: false
                    },
                    ...(options?.useMemo?.alternates || [])
                ],
            },
            useCallback: {
                prefer: 'useCallback',
                commentOnly: false,
                ...options?.useCallback,
                alternates:[
                    {
                        hookName: 'useCallback',
                        hookModulePath: 'react',
                        withDepList: true,
                        isDefaultExport: false
                    },
                    ...(options?.useCallback?.alternates || [])
                ]
            }
        };


        const normalizedHookConfig: Record<'useMemo' | 'useCallback',NormalizedMemoAlternate[]> = {
            useMemo: normalizeAlternates(hookConfig.useMemo.alternates),
            useCallback: normalizeAlternates(hookConfig.useCallback.alternates),
        }

        const allowAllAttributes = !options.allowAttributes || options.allowAttributes.some((attr) => attr === '*');
        const {
            exactSet: allowAttrExactSet,
            regexpList: allowAttrRegexpList
        } = processMatchConfig(options.allowAttributes || []);

        const tsService = ESLintUtils.getParserServices(context);

        console.log('=> hookConfig', hookConfig);
        const sourceFile = tsService.program.getSourceFile(context.filename);

        const shouldAddTypes = options.typeDefinitions !== false && Boolean(sourceFile?.fileName.endsWith('tsx'));
        const ignoredComponentsConfig = options.ignoredComponents || [];
        const declarationsPosition = options.declarationsPosition || "end";

        // Process ignored components config
        const {
            exactSet,
            regexpList
        } = processMatchConfig(ignoredComponentsConfig);
        const filename = context.filename;

        // TypeScript service for type analysis

        const tsChecker = tsService.program.getTypeChecker();
        const scopeManager = context.sourceCode.scopeManager!;

        const sourceCode = context.sourceCode;

        const currentFilePath = context.filename;
        const tsConfigPath = findTsConfigPath(path.dirname(currentFilePath));

        const printer = ts.createPrinter();
        return {
            // Detect object literals in JSX attributes
            JSXAttribute(node) {
                if (!node.value) return;
                if (typeof node.name.name !== "string") return;

                const attrName = node.name.name;
                if (!allowAllAttributes && !matchWithExactOrRegex(attrName, allowAttrExactSet, allowAttrRegexpList)) {
                    return;
                }

                if (node.value.type !== AST_NODE_TYPES.JSXExpressionContainer) return;

                const expressionType = node.value.expression.type;
                if (
                    (expressionType !== AST_NODE_TYPES.ObjectExpression) &&
                    (expressionType !== AST_NODE_TYPES.CallExpression || !options.checkReturnValueOfCalling) &&
                    (expressionType !== AST_NODE_TYPES.NewExpression || !options.checkNewExpression) &&
                    (expressionType !== AST_NODE_TYPES.Literal || !('regex' in node.value.expression) || !options.checkRegExp) &&
                    (expressionType !== AST_NODE_TYPES.MemberExpression || !('object' in node.value.expression) || node.value.expression.object.type !== AST_NODE_TYPES.ObjectExpression) &&
                    (expressionType !== AST_NODE_TYPES.MemberExpression || !('object' in node.value.expression) || node.value.expression.object.type !== AST_NODE_TYPES.NewExpression || !options.checkNewExpression) &&
                    (expressionType !== AST_NODE_TYPES.MemberExpression || !('object' in node.value.expression) || node.value.expression.object.type !== AST_NODE_TYPES.ArrowFunctionExpression || !options.checkFunction) &&
                    (expressionType !== AST_NODE_TYPES.MemberExpression || !('object' in node.value.expression) || node.value.expression.object.type !== AST_NODE_TYPES.FunctionExpression || !options.checkFunction) &&
                    (expressionType !== AST_NODE_TYPES.MemberExpression || !('object' in node.value.expression) || node.value.expression.object.type !== AST_NODE_TYPES.ArrayExpression || !options.checkArray) &&
                    (expressionType !== AST_NODE_TYPES.ArrayExpression || !options.checkArray) &&
                    (expressionType !== AST_NODE_TYPES.FunctionExpression && expressionType !== AST_NODE_TYPES.ArrowFunctionExpression || !options.checkFunction)
                ) {
                    return;
                }
                const jsxElement = node.parent;
                let componentName = getComponentName(jsxElement);
                if (matchWithExactOrRegex(componentName, exactSet, regexpList)) {
                    return;
                }

                const expression = node.value.expression;
                const tsExpression = tsService.esTreeNodeToTSNodeMap.get(expression) as ts.FunctionExpression | ts.ObjectLiteralExpression;


                const functionComponentNode = findParentNode(expression.parent, [
                    AST_NODE_TYPES.FunctionExpression,
                    AST_NODE_TYPES.FunctionDeclaration,
                    AST_NODE_TYPES.ArrowFunctionExpression
                ], (current) => {
                    if (current.parent) {
                        const expContainer = findParentNode(current.parent, [AST_NODE_TYPES.JSXExpressionContainer]);
                        return !!expContainer;
                    }


                    return false;
                });

                if (!functionComponentNode) {
                    // not in FC, unnecessary apply the rule.
                    return;
                }


                /**
                 * For value of props to this rule are only two basic kinds that need to be processed,
                 * they are 'useMemo' and 'useCallback'
                 */
                const baseHookName = (
                    expressionType === AST_NODE_TYPES.ObjectExpression
                    || expressionType === AST_NODE_TYPES.ArrayExpression
                    || expressionType === AST_NODE_TYPES.NewExpression
                    || expressionType === AST_NODE_TYPES.CallExpression
                    || expressionType === AST_NODE_TYPES.MemberExpression
                    || expressionType === AST_NODE_TYPES.Literal
                ) ? 'useMemo' : 'useCallback';

                const preferHookName = hookConfig[baseHookName].prefer ?? baseHookName;


                const hookAlternates = normalizedHookConfig[baseHookName];
                let hook: WrapAlternate = hookAlternates[0]!;

                let targetCommentNode: TSESTree.Comment | null = null;
                const addRemoveCommentFix = (fixer: RuleFixer,fixes: RuleFix[], comment?: TSESTree.Comment | null) => {
                    if (!comment) {
                        return;
                    }

                    fixes.push(
                        fixer.remove(comment)
                    )
                }

                const commentOnly = hookConfig[baseHookName]?.commentOnly;
                let matchedCommandComment = false;

                const comments = sourceCode.getCommentsBefore(node);
                const closestComment = comments[comments.length - 1];
                if (closestComment && closestComment.loc.start.line + 1 == node.loc.start.line) {
                    targetCommentNode = closestComment;

                    for (const normalized of hookAlternates) {
                        const match = closestComment.value.match(normalized.regExp);
                        if(!match) continue;
                        matchedCommandComment = true;

                        hook = normalized;
                        break;
                    }
                }


                if(!matchedCommandComment) {
                    if(commentOnly) return;

                    if(preferHookName) {
                        for (const hookAlternate of hookAlternates) {
                            if(hookAlternate.hookName === preferHookName)  {

                                hook = hookAlternate;
                                break;
                            }
                        }
                    }
                }


                const propName = attrName;

                const references = findReferenceUsagesInScope(tsService, expression);

                /**
                 * will ignore the arguments in this pattern:
                 *
                 * <div>
                 *  {
                 *      list.map((item) => {
                 *                ^---- if some variable references this argument will not get processed
                 *
                 *          return <div onClick={() => {
                 *              console.log(item);
                 *                          ^---- there occurs a reference to the argument of the map's predicate function
                 *          }}
                 *                      key={item.id}
                 *          />
                 *      })
                 *  }
                 *  </div>
                 */
                let isUsingMapCallbackArguments = false;
                const componentScopedReferences = references.filter(({symbol: s, node: sNode}) => {
                    if (!s.valueDeclaration || isUsingMapCallbackArguments) return false;
                    let symbolNode = tsService.tsNodeToESTreeNodeMap.get(s.valueDeclaration!);

                    const foundFunctionNode =
                        findParentNode(
                            symbolNode,
                            [AST_NODE_TYPES.FunctionDeclaration, AST_NODE_TYPES.ArrowFunctionExpression]
                        );

                    if (foundFunctionNode) {
                        isUsingMapCallbackArguments = isNodeDescendant(
                            tsService.esTreeNodeToTSNodeMap.get(foundFunctionNode),
                            tsService.esTreeNodeToTSNodeMap.get(functionComponentNode)
                        )
                    }

                    return foundFunctionNode === functionComponentNode;
                });

                if (isUsingMapCallbackArguments) {
                    return;
                }

                const scenes = new Set<FixScene>();
                if (componentScopedReferences.length || matchedCommandComment ) {
                    /**
                     * const C1 = () => {
                     *  const [count, setCount] = useState(0)
                     *  return <button onClick={() => { 
                     *      console.log(count)
                     *                   ^--- the reference(one of "componentScopedReferences") to count that within component scope,
                     *                        so this callback of "onClick" couldn't get extracted as a top-level constant
                     *  }}>{count}</button>
                     */
                    console.log(`=> ${componentName} ${node.name.name} attribute exists references to states of component:`, componentScopedReferences.map(r => r.symbol.name));
                    scenes.add('hook');
                } else {
                    scenes.add('top-level-constant');
                    if (baseHookName === 'useCallback') {
                        scenes.add('hook');
                    }

                    console.log(`=>(index.ts:164) ${componentName}'s ${propName} is no externalReferences`,);
                }


                const resolvedTypeInfo = getTypeNodeForProp(
                    node,
                    propName,
                    componentName,
                    true,
                    shouldAddTypes,
                    tsService,
                    filename,
                );


                let importUpdateResults: ImportUpdateResult[] = [];

                const pushImport = (update: ImportUpdateResult | ImportUpdateResult[]) => {
                    if (sourceFile) {
                        importUpdateResults = mergeImportUpdateResults(importUpdateResults.concat(update), path.dirname(filename), tsChecker, sourceFile);
                    }
                }


                let attrType: ts.Type | ts.TypeNode | undefined = resolvedTypeInfo?.type;

                let typeHasImported = false;
                if (resolvedTypeInfo && sourceFile) {
                    const {
                        results: importUpdates,
                        scene: importScene
                    } = analyzeTypeAndCreateImports(resolvedTypeInfo.type, tsService, tsChecker, sourceFile, tsService.program, scopeManager, currentFilePath, tsConfigPath);
                    typeHasImported = importScene === 'imported';
                    pushImport(importUpdates)
                }

                // if unable to import the type of attr, will use type extraction; ( Parameters<ComponentName>['0']['propName'] )
                if (!importUpdateResults.length && resolvedTypeInfo && !typeHasImported && shouldAddTypes) {
                    attrType = getExtractType(componentName, propName, attrType, hook.hookName, resolvedTypeInfo, tsService, tsChecker);
                }

                console.log("=>(rule.ts:203) importUpdateResults", importUpdateResults.length, '\n\n');
                const programNode = context.sourceCode.ast;
                const suggestList: MutableArray<Parameters<typeof context.report>[0]['suggest'] & {}> = [];
                type FixFn = Parameters<typeof context.report>[0]['fix'];


                if (scenes.has('hook')) {
                    const beforeCheckDuplicate = baseHookName === 'useCallback' ? (name: string) => {
                        const onKeywordIndex = name.indexOf('On');
                        if (onKeywordIndex > -1) {
                            const digOutOnKeyword = name.slice(0, onKeywordIndex) + name.slice(onKeywordIndex + 2);
                            name = `handle${digOutOnKeyword.charAt(0).toUpperCase() + digOutOnKeyword.slice(1)}`;
                        }
                        return name;
                    } : undefined;

                    const variableName = generateVariableName(expression, tsService, componentName, propName, true, beforeCheckDuplicate);

                    const fixFn: FixFn = (fixer) => {
                        const fixes: RuleFix[] = [];
                        if (sourceFile) {
                            pushImport(createImport(hook.hookName, hook.hookModulePath, hook.isDefaultExport, sourceFile, tsService.program));
                        }

                        addRemoveCommentFix(fixer, fixes, targetCommentNode);
                        injectWithImport(fixer, fixes, tsService, printer, importUpdateResults, sourceFile);

                        fixes.push(fixer.replaceText(expression, variableName));

                        const noConsistReferences = hook.withDepList ? componentScopedReferences.filter(ref => {
                            const refType = tsChecker.getTypeOfSymbol(ref.symbol);
                            const isSetStateFunction = SET_STATE_TYPE_STRING_PATTERN.test(tsChecker.typeToString(refType));
                            const isRefObject = REF_PATTERN.test(tsChecker.typeToString(refType));

                            return !isSetStateFunction && !isRefObject
                        }) : [];

                        const {text: hookStatementText, variableStatement} = createMemoCallbackHookDeclarationText(hook.hookName, tsExpression, variableName, attrType, noConsistReferences, !hook.withDepList, printer, sourceFile, tsChecker);

                        if (functionComponentNode.body.type === AST_NODE_TYPES.BlockStatement) {

                            const {
                                insertPosition,
                                indent
                            } = getPositionBetweenReturnAndSymbols(
                                functionComponentNode.body,
                                componentScopedReferences,
                                tsService
                            )

                            fixes.push(fixer.insertTextAfterRange([insertPosition, insertPosition],
                                addIndentationToEachLine(hookStatementText, indent)
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


                        return fixes;
                    };


                    suggestList.push({
                        messageId: 'fixWithUseHook',
                        data: {name: variableName, hookName: hook.hookName},
                        fix: fixFn
                    })
                }

                if (scenes.has('top-level-constant')) {
                    const variableName = generateVariableName(expression, tsService, componentName, propName, false);

                    const fixFn: FixFn = (fixer) => {
                        const fixes: RuleFix[] = [];
                        addRemoveCommentFix(fixer, fixes, targetCommentNode);
                        injectWithImport(fixer, fixes, tsService, printer, importUpdateResults, sourceFile);


                        // Replace object literal with variable name
                        fixes.push(fixer.replaceText(expression, variableName));

                        // Determine insert position
                        const insertPosition = declarationsPosition === "start"
                            ? findStartInsertPosition(programNode)
                            : findEndInsertPosition(programNode);

                        const {text: declarationText} = createConstDeclarationText(tsExpression, variableName, attrType, printer, sourceFile, tsChecker);

                        if (declarationsPosition === "start") {
                            const insertAfterNode = context.sourceCode.getNodeByRangeIndex(insertPosition);
                            if (insertAfterNode) {
                                fixes.push(fixer.insertTextAfter(insertAfterNode, declarationText));
                            }
                        } else {
                            // Insert at ending of the file
                            const lastToken = context.sourceCode.getLastToken(programNode);
                            if (lastToken) {
                                fixes.push(fixer.insertTextAfter(lastToken, declarationText));
                            }
                        }


                        return fixes;
                    };

                    suggestList.push({
                        messageId: 'fixWithTopLevelScopeConstant',
                        data: {name: variableName},
                        fix: fixFn

                    });

                }

                context.report({
                    node,
                    messageId: `noInline`,
                    data: {
                        type: expressionType,
                        propName
                    },
                    suggest: suggestList,
                    fix: suggestList[0]!.fix
                });
            },

        };
    }
});


const createHookRegExp = (hookName: string) => {
    return new RegExp(`^\\s*(${hookName})`)
}

interface NormalizedMemoAlternate extends WrapAlternate {
    regExp: RegExp,
}

const normalizeAlternates = (alternates?:WrapAlternate[]) => {
    if(!alternates) return [];

    return alternates.map((alternate) => {
        return {
            regExp: createHookRegExp(alternate.hookName),
            ...alternate
        }
    });
}

