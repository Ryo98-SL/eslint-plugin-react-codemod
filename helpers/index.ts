import {AST_NODE_TYPES, type TSESTree} from "@typescript-eslint/typescript-estree";
import ts, {SyntaxKind} from 'typescript';
import {getReactSourceFile, resolveModulePath} from "./resolve-helper/resolve-module-path.ts";
import type {ResolvedCompPropTypeInfo, TsService, TypedRuleContext} from "./types";
import {findIntrinsicElementsInterface, findParentNode} from "./resolve-helper/pin.ts";


/**
 * Get property type from TS compiler
 * @param node - JSX attribute node
 * @param propName - Property name
 * @param tsService - TypeScript service
 * @param filename - File name
 * @returns Type string
 */
const getTypeFromTsCompiler = (
    node: TSESTree.Node,
    propName: string,
    tsService: TsService | null,
    filename: string
): ResolvedCompPropTypeInfo | null => {
    let thatType: ResolvedCompPropTypeInfo | null = null;

    if (!tsService) return thatType;

    const tsChecker = tsService.program.getTypeChecker();

    try {
        if (node.type === AST_NODE_TYPES.JSXAttribute && node.value?.type === AST_NODE_TYPES.JSXExpressionContainer) {

            const jsxElement = findParentNode(node, AST_NODE_TYPES.JSXElement);
            if (jsxElement) {

                if (jsxElement.openingElement.name.type === AST_NODE_TYPES.JSXIdentifier) {
                    const tagName = jsxElement.openingElement.name.name;
                    if(tagName.match(/^[a-z]/)) {
                        const sourceFile = getReactSourceFile(tsService.program);
                        if (sourceFile) {
                            const IntrinsicElements = findIntrinsicElementsInterface(sourceFile, tsChecker);
                            const propertySignature = IntrinsicElements?.members.find(member => {
                                if (member.kind === SyntaxKind.PropertySignature && member.name) {
                                    return member.name.getText() === tagName
                                }
                            });

                            if (ts.isPropertySignature(propertySignature!) && propertySignature.type) {
                                const propSymbol = tsChecker.getTypeAtLocation(propertySignature.type).getProperties().find(prop => {
                                    return prop.name === propName
                                });


                                const propType = tsChecker.getTypeOfSymbol(propSymbol!);

                                thatType = {
                                    propsType: tsChecker.getTypeFromTypeNode(propertySignature.type),
                                    type: propType
                                };
                            }
                        }
                    } else {

                        const program = tsService.program;
                        const sourceFile = program.getSourceFile(filename);

                        if (sourceFile) {
                            // 尝试在当前作用域查找组件的符号
                            const symbol = tsService.getSymbolAtLocation(jsxElement.openingElement.name);
                            if (symbol) {
                                // 获取组件类型
                                const componentType = tsChecker.getTypeOfSymbol(symbol);

                                // 查找签名（例如函数调用签名）
                                const signatures = componentType.getCallSignatures();
                                if (signatures.length > 0) {
                                    // 获取第一个参数（props）的类型
                                    const parameters = signatures[0]!.getParameters();
                                    const propsSymbol = parameters[0]!;

                                    const propsType = tsChecker.getTypeOfSymbol(propsSymbol);

                                    if (propsType) {
                                        // 查找特定属性
                                        const property = propsType.getProperty(propName);
                                        if (property) {
                                            thatType = {
                                                type: tsChecker.getTypeOfSymbol(property),
                                                propsType: propsType
                                            };
                                        }
                                    }
                                }
                            }
                        }

                    }
                }



            }
        }

    } catch (e) {
        console.warn('get type failed', e);
    }

    return thatType
};


/**
 * Extract type information for component props
 * @param node - JSX attribute node
 * @param propName - Property name
 * @param componentName - Component name
 * @param isTypeScriptFile - Whether the file is a TypeScript file
 * @param shouldAddTypes - Whether to add type definitions
 * @param tsService - TypeScript service
 * @param filename - File name
 * @returns Type annotation
 */
export const getTypeNodeForProp = (
    node: any,
    propName: string,
    componentName: string,
    isTypeScriptFile: boolean,
    shouldAddTypes: boolean,
    tsService: TsService | null,
    filename: string,
): ResolvedCompPropTypeInfo | null => {
    // If not a TypeScript file or no type definitions needed, return empty string
    if (!isTypeScriptFile || !shouldAddTypes) {
        return null;
    }


    // 4. Default to Record type
    return getTypeFromTsCompiler(node, propName, tsService, filename);
};

export const isNodeDescendant = (node: ts.Node, potentialAncestor: ts.Node): boolean => {
    let current: ts.Node | undefined = node.parent;
    while (current) {
        if (current === potentialAncestor) {
            return true;
        }
        current = current.parent;
    }
    return false;
};

export const isNodeDescendantWithKind = <T extends SyntaxKind>(node: ts.Node, kind: T): null | ts.Node => {
    let current: ts.Node | undefined = node.parent;
    while (current) {
        if (current.kind === kind) {
            return current;
        }
        current = current.parent;
    }

    return null
};


export const typeFlagsIntersectionInfo = (flags: ts.TypeFlags) => {
    const decimalReg = /^\d/;
    const array = Object.entries(ts.TypeFlags)
        .filter(([flagName]) => {
            return !decimalReg.test(flagName)
        })
        .map(([flagName, flag]) => {

        return [ flagName, ((flag as number) & flags) !== 0 ];
    })
        .reduce(( parts ,[flagName, result]) => {
            parts[result ? 'intersect' : 'excludes'].push(flagName as unknown as ts.TypeFlags);

            return parts;
        }, { intersect: [], excludes: [] } as { intersect: ts.TypeFlags[], excludes: ts.TypeFlags[] })

    return array;

}



export const SetStateTypeStringPattern = /Dispatch<SetStateAction<.*>>/
export const RefPattern = /(RefObject|MutableRefObject)<.*>/

export * from './resolve-helper/pin.ts';
export * from './resolve-helper/resolve-module-path.ts';
export * from './resolve-helper/format-output.ts';
export * from './types/index.ts';
export * from './resolve-helper/process-config.ts';
export * from './resolve-helper/resolve-imports.ts';
export * from './resolve-helper/resolve-type.ts';
export {createRule} from "./create-rule.ts";
export * from './default-options.ts';
export * from './comment-directives.ts';
