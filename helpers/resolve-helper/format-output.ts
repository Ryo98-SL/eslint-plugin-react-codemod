import {AST_NODE_TYPES, TSESTree} from "@typescript-eslint/typescript-estree";
import ts, {type BindingName, SymbolFlags} from "typescript";

import type {TsService} from "../types";


import {findParentNode} from "./pin.ts";

export const getPositionBetweenReturnAndSymbols = (
    body: TSESTree.BlockStatement,
    symbols: { symbol: ts.Symbol, node: ts.Node }[],
    tsService: TsService,
) => {
    let defaultIndent = 0;
    let end = 0;


    /**
     * find top level statement which is a ReturnStatement or contains a ReturnStatement
     *
     * ```tsx
     *  // case 1.
     *  return <span></span>
     *  // ^---- this will match and being returned as the result of findTopLevelReturnStatement.
     *
     *  // case 2.
     *  if(props.error) {
     *  // ^---- this IfStatement will match, because it contains the ReturnStatement
     *      return <span></span>
     *      // ^---- contained by its parent statement IfStatement
     *  }
     *
     * ```
     */
    const findTopLevelReturnStatement = (statement: TSESTree.Statement) => {
        if(statement.type == AST_NODE_TYPES.ReturnStatement) {
            return statement;
        }

        if(statement.type === AST_NODE_TYPES.IfStatement) {
            if(statement.consequent.type === AST_NODE_TYPES.ReturnStatement) {
                return statement;
            } else if(statement.consequent.type === AST_NODE_TYPES.BlockStatement) {
                for (const statementElement of statement.consequent.body) {
                    if (findTopLevelReturnStatement(statementElement)) return statement;
                }
            }
        }
        return;
    }

    const returnSt = body.body.find(st => findTopLevelReturnStatement(st));

    if (returnSt) {
        end = returnSt.range[0];
        defaultIndent = returnSt.loc.start.column;
    } else {
        end = body.range[1];
        defaultIndent = body.body[0]?.loc.start.column ?? 2;
    }


    const {
        end: insertPosition,
        indent
    } = symbols.reduce((info, {symbol}) => {
        const _pos = (symbol.valueDeclaration!).end;
        const parent = findParentNode(tsService.tsNodeToESTreeNodeMap.get(symbol.valueDeclaration!), [AST_NODE_TYPES.FunctionDeclaration, AST_NODE_TYPES.VariableDeclaration, AST_NODE_TYPES.ClassDeclaration]);


        if (info.end < _pos) {
            return {end: (parent?.range[1] ?? 0) + 1, indent: parent?.loc.start.column ?? 0}
        }

        return info;
    }, {end, indent: defaultIndent});


    return {
        insertPosition,
        indent
    }
}



export const transformFunctionWithNonBlockStatement = (
    fnNode: TSESTree.ArrowFunctionExpression,
    tsService: TsService,
    additionalVariableStatement: ts.VariableStatement,
) => {
    const fnCompNode = tsService.esTreeNodeToTSNodeMap.get(fnNode);
    const bodyNode = tsService.esTreeNodeToTSNodeMap.get(fnNode.body);

    const returnSt = ts.factory.createReturnStatement(bodyNode as ts.JsxElement);


    return ts.factory.createArrowFunction(
        fnCompNode.modifiers?.map(modifier => ts.factory.createModifier(modifier.kind)),
        fnCompNode.typeParameters,
        fnCompNode.parameters,
        fnCompNode.type,
        undefined,
        ts.factory.createBlock([
            additionalVariableStatement,
            returnSt
        ], true)
    );
};
export const createConstDeclarationText = (
    tsExpression: ts.FunctionExpression | ts.ObjectLiteralExpression,
    variableName: string,
    type: ts.Type | ts.TypeNode | undefined | null,
    printer: ts.Printer,
    sourceFile: ts.SourceFile | undefined,
    tsChecker: ts.TypeChecker) => {

    const typeNode = type
        ? 'getSourceFile' in type
            ? type
            : tsChecker.typeToTypeNode(type, undefined, undefined)
        : undefined;

    const variableDeclaration = ts.factory.createVariableDeclaration(variableName, undefined, typeNode, tsExpression);

    const variableDeclarationList = ts.factory.createVariableDeclarationList([variableDeclaration], ts.NodeFlags.Const);
    const variableStatement = ts.factory.createVariableStatement(undefined, variableDeclarationList);
    let declarationString = printer.printNode(ts.EmitHint.Unspecified, variableStatement, sourceFile!);

    return {
        declaration: variableDeclarationList,
        text: '\n' + declarationString + '\n'
    };
};
export const createMemoCallbackHookDeclarationText = (
    hookName: string,
    tsExpression: ts.FunctionExpression | ts.ObjectLiteralExpression,
    variableName: string,
    type: ts.Type | ts.TypeNode | undefined | null,
    references: { symbol: ts.Symbol; node: ts.Node }[],
    noDepListArg: boolean,
    printer: ts.Printer,
    sourceFile: ts.SourceFile | undefined
    , tsChecker: ts.TypeChecker) => {

    let typeNode: ts.TypeNode | undefined;

    if(type && 'getSourceFile' in type) {
        typeNode = type;
    } else {
        if (type?.isUnion() && hookName === 'useCallback') {
            const types = type.types.filter(_type => !!_type.getCallSignatures().length);

            typeNode = ts.factory.createUnionTypeNode(types.map(t => tsChecker.typeToTypeNode(t, undefined, undefined)).filter(t => !!t));
        } else {
            typeNode = type ? tsChecker.typeToTypeNode(type, undefined, undefined) : undefined;
        }
    }

    const identifier = ts.factory.createIdentifier(hookName);

    let firstExpress: ts.Expression;


    if (hookName === 'useMemo') {
        const returnSt = ts.factory.createReturnStatement(tsExpression);
        const bodyBlock = ts.factory.createBlock([
            returnSt
        ]);

        const wrapperArrowFnExpression = ts.factory.createArrowFunction(undefined, undefined, [], undefined, undefined, bodyBlock);

        firstExpress = wrapperArrowFnExpression
    } else {

        firstExpress = tsExpression;
    }

    const argumentsArray: ts.Expression[] = [
        firstExpress
    ];

    if(!noDepListArg) {
        const referencesIdentifiers = references.map(ref => {
            /**
             * let the entire expression append to deps list:
             *
             * useEffect(() => {
             *     console.log(props.data);
             *                 ^----
             * }, [ props.data ])
             *      ^----
             */
            if(ts.isPropertyAccessExpression(ref.node)) {
                return ref.node
            }

            return ts.factory.createIdentifier(ref.symbol.name);
        });

        const depsArray = ts.factory.createArrayLiteralExpression(referencesIdentifiers);
        argumentsArray.push(depsArray);
    }



    const hookExpression = ts.factory.createCallExpression(
        identifier,
        typeNode ? [typeNode] : typeNode,
        argumentsArray
    );


    const variableDeclaration = ts.factory.createVariableDeclaration(variableName, undefined, undefined, hookExpression);
    const variableDeclarationList = ts.factory.createVariableDeclarationList([variableDeclaration], ts.NodeFlags.Const);

    const variableStatement = ts.factory.createVariableStatement(undefined, variableDeclarationList);

    let declarationString = printer.printNode(ts.EmitHint.Unspecified, variableStatement, sourceFile!);

    return {
        text: '\n' + declarationString + '\n',
        variableStatement
    }
}

const unionWitNullTypeNode = (
    typeNode: ts.TypeNode | undefined,
) => {

    if(typeNode) {
        const hasNullType = ts.isUnionTypeNode(typeNode)
            ? !!typeNode.types.find(tn => tn.kind === ts.SyntaxKind.NullKeyword)
            : typeNode.kind === ts.SyntaxKind.NullKeyword;

        if(!hasNullType) {

            const nullType = ts.factory.createLiteralTypeNode(
                ts.factory.createNull()
            );

            return ts.factory.createUnionTypeNode([
                typeNode!,
                nullType
            ]);
        }
    }

    return typeNode;
}

export const createRefHookDeclarationText = (
    hookName: string,
    kind: 'state' | 'reference',
    variableName: string,
    stateVariableName: string | undefined,
    type: ts.Type | ts.TypeNode | undefined,
    printer: ts.Printer
    , sourceFile: ts.SourceFile | undefined, tsChecker: ts.TypeChecker) => {
    const identifier = ts.factory.createIdentifier(hookName);
    let typeNode = type && ( 'getSourceFile' in type ? type : tsChecker.typeToTypeNode(type, undefined, undefined));

    if(kind == 'state') {
        /**
         * If it's 'state' kind, then let the type of ref prop union with null type,
         * example:
         * useRef<RefType> // kind 'reference'
         *
         * useState<RefType | null> // kind 'state'
         *
         */
        typeNode = unionWitNullTypeNode(typeNode);
    }

    const valueNode = ts.factory.createNull();

    const hookExpression = ts.factory.createCallExpression(
        identifier,
        typeNode ? [typeNode] : typeNode,
        [
            valueNode,
        ]
    );

    let factoryVariableName: string | BindingName;
    if(kind === 'state') {
        /**
         * create elements for following pattern:
         * [state, setState]
         */
        const variableBindingElement = ts.factory.createBindingElement(undefined, undefined, stateVariableName!);
        const setVariableBindingElement = ts.factory.createBindingElement(undefined, undefined, variableName);

        factoryVariableName = ts.factory.createArrayBindingPattern([
            variableBindingElement,
            setVariableBindingElement
        ])
    } else {
        factoryVariableName = variableName;
    }

    const variableDeclaration = ts.factory.createVariableDeclaration(factoryVariableName, undefined, undefined, hookExpression);
    const variableDeclarationList = ts.factory.createVariableDeclarationList([variableDeclaration], ts.NodeFlags.Const);

    const variableStatement = ts.factory.createVariableStatement(undefined, variableDeclarationList);
    let declarationString = printer.printNode(ts.EmitHint.Unspecified, variableStatement, sourceFile!);

    return {
        text: '\n' + declarationString + '\n',
        variableStatement
    }
}

/**
 * Get component name from JSX element
 * @param jsxElement - JSX element node
 * @returns Component name
 */
export const getComponentName = (jsxElement: any): string => {
    if (!jsxElement || !jsxElement.name) {
        return 'Component';
    }

    if (jsxElement.name.type === 'JSXIdentifier') {
        return jsxElement.name.name;
    } else if (jsxElement.name.type === 'JSXMemberExpression') {
        // Handle cases like Namespace.Component
        return jsxElement.name.property.name;
    }

    return 'Component';
};
export const generateVariableName = (
    sourceNode: TSESTree.Node,
    tsService: TsService,
    componentName: string,
    propName: string,
    capitalLower?: boolean,
    beforeCheckDuplicate?: (name: string) => string
): string => {
    // Convert property name to PascalCase

    let propNamePascal = propName
        .split(/[-_]/)
        .map((part, index) => part.charAt(0)['toUpperCase']() + part.slice(1))
        .join('');

    // Ensure first letter is uppercase
    propNamePascal = propNamePascal.charAt(0).toUpperCase() + propNamePascal.slice(1);

    if (capitalLower) {
        componentName = componentName[0]!.toLowerCase() + componentName.slice(1);
    }

    // Combine to create ComponentNamePropName format
    let baseName = `${componentName}${propNamePascal}`;

    const scopedVariables = tsService.program.getTypeChecker().getSymbolsInScope(
        tsService.esTreeNodeToTSNodeMap.get(sourceNode),
        SymbolFlags.BlockScopedVariable
    ).map(s => s.name);

    // Check for name conflicts, add numeric suffix if needed
    let finalName = beforeCheckDuplicate?.(baseName) ?? baseName;
    let count = 1;

    while (scopedVariables.includes(finalName)) {
        finalName = `${finalName}${count}`;
        count++;
    }

    return finalName;
}; // 在每行添加额外的空格（通过操作原始代码）
export const addIndentationToEachLine = (code: string, spacesToAdd: number = 2, ignoreBeginning = true): string => {
    const spaces = ' '.repeat(spacesToAdd);
    const strings = code.split('\n');

    return strings.map((line, index) => (index === 0 && ignoreBeginning ? '' : spaces) + line).join('\n');
};