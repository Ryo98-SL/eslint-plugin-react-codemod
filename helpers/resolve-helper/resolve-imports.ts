import ts, {type NamedImports, ObjectFlags, SyntaxKind, TypeFlags, type UnionOrIntersectionType} from "typescript";
import type { ImportUpdateResult, ModuleInfo, TsService, TypedRuleContext } from "../types/index.ts";
import type {RuleFix, RuleFixer} from "@typescript-eslint/utils/ts-eslint";
import {resolveModulePath} from "./resolve-module-path.ts";
import path from "path";
import type {ScopeManager} from "@typescript-eslint/scope-manager";
import {findSymbolExportInfo} from "./pin.ts";
import * as util from "node:util";
import {resolvePathToAlias} from "./process-config.ts";

function normalizeModuleSpecifierKey(moduleName: string, sourceFilePath: string, program: ts.Program): string {
    const dirname = path.dirname(sourceFilePath);
    const resolvedModulePath = resolveModulePath(moduleName, program, sourceFilePath);
    if (resolvedModulePath) {
        return resolvedModulePath.replace(/\\/g, '/');
    }

    if (path.isAbsolute(moduleName)) {
        return moduleName.replace(/\\/g, '/');
    }

    // Bare specifiers like aliases or package names should stay as-is.
    if (!moduleName.startsWith('.')) {
        const projectRelativePath = path.resolve(program.getCurrentDirectory(), moduleName);
        if (ts.sys.fileExists(projectRelativePath)) {
            return projectRelativePath.replace(/\\/g, '/');
        }

        return moduleName;
    }

    return path.resolve(dirname, moduleName).replace(/\\/g, '/');
}

/**
 * 为指定的具名值创建导入声明
 * @param entityName 需要导入的具名值
 * @param modulePath 模块路径
 * @param sourceFile 源文件
 * @returns 包含原始声明和新声明的结果对象
 */
export function createImport(
    entityName: string,
    modulePath: string,
    isDefaultImport: boolean,
    sourceFile: ts.SourceFile,
    program: ts.Program
): ImportUpdateResult {
    const factory = ts.factory;

    // 查找现有导入声明
    const existingImport = findExistingImport(modulePath, sourceFile, program);

    // 创建导入说明符
    const importSpecifier = factory.createImportSpecifier(
        false,
        undefined,
        factory.createIdentifier(entityName)
    );

    let defaultImport: ts.Identifier | undefined;
    let namedImports: NamedImports | undefined;

    if (isDefaultImport) {
        defaultImport = factory.createIdentifier(entityName);
    } else {
        namedImports = factory.createNamedImports([importSpecifier]);
    }
    // 创建命名导入


    // 创建导入子句
    const importClause = factory.createImportClause(
        false,
        defaultImport,
        namedImports
    );

    // 创建导入声明
    const importDecl = factory.createImportDeclaration(
        undefined,
        importClause,
        factory.createStringLiteral(modulePath)
    );

    return {
        originalDeclaration: existingImport,
        newDeclaration: importDecl
    };
}

/**
 * 在源文件中查找指定模块路径的现有导入声明
 * @param sourceFile 源文件
 * @param modulePath 模块路径
 * @returns 找到的导入声明，如果不存在则返回null
 */
function findExistingImport(modulePath: string, sourceFile: ts.SourceFile, progrom: ts.Program): ts.ImportDeclaration | null {
    const targetModuleKey = normalizeModuleSpecifierKey(modulePath, sourceFile.fileName, progrom);

    for (const statement of sourceFile.statements) {
        if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
            const existingModuleKey = normalizeModuleSpecifierKey(statement.moduleSpecifier.text, sourceFile.fileName, progrom);
            if (existingModuleKey === targetModuleKey) {
                return statement;
            }
        }
    }
    return null;
}

/**
 * 合并多个 ImportUpdateResult 中的 ImportDeclaration
 * @param results ImportUpdateResult 数组
 * @returns 合并后的 ImportUpdateResult 数组
 */
export function mergeImportUpdateResults(results: ImportUpdateResult[], dirname: string, tsChecker: ts.TypeChecker, sourceFile: ts.SourceFile): ImportUpdateResult[] {
    const moduleMap = new Map<string, ImportUpdateResult>();

    for (const result of results) {
        const moduleSpecifier = ts.isStringLiteral(result.newDeclaration.moduleSpecifier)
            ? path.resolve(dirname, result.newDeclaration.moduleSpecifier.text)
            : '';

        if (!moduleMap.has(moduleSpecifier)) {
            if (result.originalDeclaration) {
                result.newDeclaration = mergeImportDeclarations(result.originalDeclaration, result.newDeclaration, sourceFile)
            }
            moduleMap.set(moduleSpecifier, result);
        } else {
            // 合并相同模块的导入声明
            const existingResult = moduleMap.get(moduleSpecifier)!;
            const mergedDeclaration = mergeImportDeclarations(
                existingResult.newDeclaration,
                result.newDeclaration,
                sourceFile
            );

            moduleMap.set(moduleSpecifier, {
                originalDeclaration: existingResult.originalDeclaration,
                newDeclaration: mergedDeclaration
            });
        }
    }

    return Array.from(moduleMap.values());
}

const ModuleRegexp = /(@types\/)?([^@\/"']+)/;
/**
 * 合并两个 ImportDeclaration
 * @param decl1 第一个 ImportDeclaration
 * @param decl2 第二个 ImportDeclaration
 * @returns 合并后的 ImportDeclaration
 */
function mergeImportDeclarations(
    decl1: ts.ImportDeclaration,
    decl2: ts.ImportDeclaration,
    sourceFile: ts.SourceFile,
): ts.ImportDeclaration {
    const factory = ts.factory;
    const printer = ts.createPrinter();

    // if found pattern like "@types/moduleName" and "moduleName", will get the "moduleName"
    const moduleSpecifier = [decl1, decl2].find((decl) => {
        const s = printer.printNode(ts.EmitHint.Unspecified,decl.moduleSpecifier,sourceFile);
        const match = s.match(ModuleRegexp);

        return match && !match[1];
    })?.moduleSpecifier || decl1.moduleSpecifier;




    const clause1 = decl1.importClause;
    const clause2 = decl2.importClause;

    // 合并默认导入
    const defaultImport = clause1?.name || clause2?.name;
    const hasValueDefaultImport = !!((clause1?.name && !clause1.isTypeOnly) || (clause2?.name && !clause2.isTypeOnly));
    const hasTypeOnlyDefaultImport = !!((clause1?.name && clause1.isTypeOnly) || (clause2?.name && clause2.isTypeOnly));

    // 合并命名绑定
    let namedBindings: ts.NamedImportBindings | undefined;

    if (clause1?.namedBindings && clause2?.namedBindings) {
        // 两个声明都有命名绑定
        if (ts.isNamespaceImport(clause1.namedBindings)) {
            // 优先保留命名空间导入
            namedBindings = clause1.namedBindings;
        } else if (ts.isNamespaceImport(clause2.namedBindings)) {
            namedBindings = clause2.namedBindings;
        } else {
            // 合并命名导入
            const namedEntries = new Map<string, NamedImportEntry>();
            for (const entry of [
                ...getNamedImportEntries(decl1, clause1.namedBindings, sourceFile),
                ...getNamedImportEntries(decl2, clause2.namedBindings, sourceFile)
            ]) {
                const existingEntry = namedEntries.get(entry.name);
                if (!existingEntry) {
                    namedEntries.set(entry.name, entry);
                    continue;
                }

                existingEntry.isTypeOnly = existingEntry.isTypeOnly && entry.isTypeOnly;
            }

            const importSpecifiers = Array.from(namedEntries.values()).map((entry) =>
                createNamedImportSpecifier(factory, entry.name, entry.isTypeOnly)
            );

            namedBindings = factory.createNamedImports(importSpecifiers);
        }
    } else {
        namedBindings = clause1?.namedBindings || clause2?.namedBindings;
    }

    // 创建新的导入子句
    const importClauseIsTypeOnly = !!(
        defaultImport
        && !namedBindings
        && !hasValueDefaultImport
        && hasTypeOnlyDefaultImport
    );
    const newImportClause = (defaultImport || namedBindings)
        ? factory.createImportClause(
            importClauseIsTypeOnly,
            defaultImport,
            namedBindings
        )
        : undefined;

    // 合并修饰符
    const modifiers = [...(decl1.modifiers || []), ...(decl2.modifiers || [])]
        .filter((m, i, arr) => arr.findIndex(mm => mm.kind === m.kind) === i);

    return factory.createImportDeclaration(
        modifiers.length > 0 ? modifiers : undefined,
        newImportClause,
        moduleSpecifier
    );
}

export const injectWithImport = (fixer: RuleFixer, fixes: RuleFix[], tsService: TsService, printer: ts.Printer, importUpdateResults?: ImportUpdateResult[], sourceFile?: ts.SourceFile) => {
    if (!sourceFile) {
        return;
    }

    importUpdateResults?.forEach((updateResult) => {
        const newImportText = printer.printNode(
            ts.EmitHint.Unspecified,
            updateResult.newDeclaration,
            sourceFile
        );

        if (updateResult.originalDeclaration) {
            const originImportDeclaration = tsService.tsNodeToESTreeNodeMap.get(updateResult.originalDeclaration);
            fixes.push(fixer.replaceText(originImportDeclaration, newImportText));
        } else {
            const lastImportStatement = sourceFile.statements.findLast(st => st.kind === SyntaxKind.ImportDeclaration)
            if (lastImportStatement) {
                const insertNodeOrToken = tsService.tsNodeToESTreeNodeMap.get(lastImportStatement);
                fixes.push(
                    fixer.insertTextAfter(insertNodeOrToken, '\n' + newImportText)
                )
            } else {
                fixes.push(
                    fixer.insertTextBeforeRange([0, 0], newImportText)
                )
            }
        }

    })
}

type TypeAndString = { type: ts.Type, name: string };
type NamedImportEntry = { name: string, isTypeOnly: boolean };

function createNamedImportSpecifier(factory: ts.NodeFactory, name: string, isTypeOnly: boolean): ts.ImportSpecifier {
    return factory.createImportSpecifier(
        isTypeOnly,
        undefined,
        factory.createIdentifier(name)
    );
}

function isTypesPackageImport(decl: ts.ImportDeclaration, sourceFile: ts.SourceFile): boolean {
    const moduleText = ts.isStringLiteral(decl.moduleSpecifier)
        ? decl.moduleSpecifier.text
        : ts.createPrinter().printNode(ts.EmitHint.Unspecified, decl.moduleSpecifier, sourceFile);

    return moduleText.startsWith('@types/');
}

function getNamedImportEntries(
    decl: ts.ImportDeclaration,
    namedBindings: ts.NamedImportBindings | undefined,
    sourceFile: ts.SourceFile
): NamedImportEntry[] {
    if (!namedBindings || !ts.isNamedImports(namedBindings)) {
        return [];
    }

    const forceTypeOnly = isTypesPackageImport(decl, sourceFile) || decl.importClause?.isTypeOnly;
    return namedBindings.elements.map((element) => ({
        name: element.name.text,
        isTypeOnly: forceTypeOnly || element.isTypeOnly
    }));
}

export function analyzeTypeAndCreateImports(
    typeToAnalyze: ts.Type,
    tsService: TsService,
    tsChecker: ts.TypeChecker,
    sourceFile: ts.SourceFile,
    program: ts.Program,
    scopeManager: ScopeManager,
    currentFilePath: string,
    configPath?: string | null, options?: { resolveToRelativePath?: boolean }): { results: ImportUpdateResult[], scene: 'normal' | 'imported'} {
    const factory = ts.factory;
    const results: ImportUpdateResult[] = [];
    const typeModulesMap = new Map<string, Set<TypeAndString>>();
    const defaultExportModulesMap = new Map<string, TypeAndString>();
    const namespaceImportModulesMap = new Map<string, TypeAndString>();

    const resolveToRelativePath = options?.resolveToRelativePath ?? true;

    const aliasPaths = program.getCompilerOptions().paths;

    // Recursive function to analyze types and collect imports
    function collectTypesToImport(type: ts.Type, visited = new Set<ts.Type>(), context: {from: string[]}) {
        const typeStr = tsChecker.typeToString(type);

        if (visited.has(type)) return;
        visited.add(type);

        // Get type symbol
        const symbol = type.getSymbol() || type.aliasSymbol;

        // Handle union and intersection types
        if (!type.aliasSymbol && type.isUnionOrIntersection()) {

            const _context = { from: [tsChecker.typeToString(type) + '_1', ...context.from] };

            let target:UnionOrIntersectionType
            // @ts-ignore
            if(type.origin && type.origin.isUnionOrIntersection()) {
                // @ts-ignore
                target = type.origin;
            } else {
                target = type;
            }

            target.types.forEach(t => collectTypesToImport(t, visited, _context));
            return;
        }

        // Handle generic type parameters
        if (type.flags & ts.TypeFlags.Object && !type.aliasSymbol) {


            const _context = { from: [tsChecker.typeToString(type) + '_2', ...context.from] };

            const objectType = type as ts.ObjectType;
            if (objectType.objectFlags & ts.ObjectFlags.Reference) {
                const typeReference = type as ts.TypeReference;
                if (typeReference.typeArguments) {
                    typeReference.typeArguments.forEach(typeArg => {
                        collectTypesToImport(typeArg, visited, _context);
                    });
                }
            }
        }

        // Handle function types' parameters and return types
        if (type.getCallSignatures && type.getCallSignatures().length > 0) {
            const _context = { from: [tsChecker.typeToString(type) + '_3', ...context.from] };

            type.getCallSignatures().forEach(signature => {
                signature.getParameters().forEach(param => {
                    const paramType = tsChecker.getTypeOfSymbolAtLocation(param, sourceFile);
                    collectTypesToImport(paramType, visited, _context);
                });

                const returnType = signature.getReturnType();
                collectTypesToImport(returnType, visited, _context);
            });
        }

        // Analyze property types
        if (type.isLiteral() && tsChecker.getPropertiesOfType(type).length > 0) {

            const _context = { from: [tsChecker.typeToString(type) + '_4', ...context.from] };

            tsChecker.getPropertiesOfType(type).forEach(prop => {
                const propType = tsChecker.getTypeOfSymbolAtLocation(prop, sourceFile);
                collectTypesToImport(propType, visited, _context);
            });
        }

        if (symbol && (!tsChecker.isArrayType(type) || type.aliasSymbol)) {
            // case for mui's SxProps<Theme> type pattern
            if(type.aliasTypeArguments && type.isUnionOrIntersection()) {
                const _context = { from: [tsChecker.typeToString(type) + '_5', ...context.from] };

                type.aliasTypeArguments.forEach(typeArg => {
                    collectTypesToImport(typeArg, visited, _context);
                });
            }

            let moduleInfo: ModuleInfo | undefined;
            moduleInfo = findSymbolExportInfo(type.aliasSymbol || type.symbol, tsChecker);

            if (moduleInfo && moduleInfo.moduleName && moduleInfo.moduleName !== sourceFile.fileName && moduleInfo.moduleName !== 'typescript') {

                let _moduleName: string;
                const moduleDir = path.dirname(sourceFile.fileName);

                let withAliasPath: string | null = null;
                if(aliasPaths && configPath ) {
                    withAliasPath = resolvePathToAlias(moduleInfo.moduleName, configPath, program.getCompilerOptions(), currentFilePath)
                }


                if(withAliasPath) {
                    _moduleName = withAliasPath;
                } else if (resolveToRelativePath && path.isAbsolute(moduleInfo.moduleName)) {
                    _moduleName = path.relative(moduleDir, moduleInfo.moduleName).replace(/\\/g, '/');
                    if (!_moduleName.startsWith('./')) {
                        _moduleName = './' + _moduleName;
                    }

                } else {
                    _moduleName = moduleInfo.moduleName;
                }

                const isInterfaceType = ((type.flags & TypeFlags.Object) && ((type as ts.ObjectType).objectFlags & ObjectFlags.Interface)) !== 0;


                if (!type.aliasSymbol && !isInterfaceType) {
                    return;
                }


                const typeName = type.aliasSymbol ? type.aliasSymbol.getName() : type.symbol.getName();
                if (!typeName) return;
                // Check if it's a default export
                if (symbol.escapedName === "default" || moduleInfo.isDefaultExport) {
                    defaultExportModulesMap.set(_moduleName, {name: typeName, type: type});
                } else {
                    // Add to named imports
                    if (!typeModulesMap.has(_moduleName)) {
                        typeModulesMap.set(_moduleName, new Set<TypeAndString>());
                    }
                    typeModulesMap.get(_moduleName)!.add({ type, name: typeName });
                }
            }

        }
    }


    // Start analyzing the type
    collectTypesToImport(typeToAnalyze, undefined, { from: ['root']});


    // Get existing import declarations
    const existingImports = new Map<string | undefined, ts.ImportDeclaration>();
    for (const statement of sourceFile.statements) {
        if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
            existingImports.set(normalizeModuleSpecifierKey(statement.moduleSpecifier.text, sourceFile.fileName, program), statement);
        }
    }

    const moduleNameToAbsolute = (name: string) => {
        return normalizeModuleSpecifierKey(name, sourceFile.fileName, program);
    }





    // Process each module that needs imports
    // Handle default imports
    for (const [moduleName, { name: importName, type }] of defaultExportModulesMap.entries()) {

        if(checkAlreadyImportTheName(importName, type, tsChecker, program, existingImports)) continue;

        const existingImport = existingImports.get(moduleNameToAbsolute(moduleName));

        // Create import clause with default import
        const importClause = factory.createImportClause(
            true,
            factory.createIdentifier(importName),
            undefined
        );

        // Create import declaration
        const importDecl = factory.createImportDeclaration(
            undefined,
            importClause,
            factory.createStringLiteral(moduleName)
        );

        results.push({
            originalDeclaration: existingImport || null,
            newDeclaration: importDecl
        });
    }

    // Handle namespace imports
    for (const [moduleName, { name: importName, type }] of namespaceImportModulesMap.entries()) {
        if(checkAlreadyImportTheName(importName, type, tsChecker, program, existingImports)) continue;

        const existingImport = existingImports.get(moduleNameToAbsolute(moduleName));

        // Create namespace import
        const namespaceImport = factory.createNamespaceImport(
            factory.createIdentifier(importName)
        );

        // Create import clause with namespace import
        const importClause = factory.createImportClause(
            true,
            undefined,
            namespaceImport
        );

        // Create import declaration
        const importDecl = factory.createImportDeclaration(
            undefined,
            importClause,
            factory.createStringLiteral(moduleName)
        );

        results.push({
            originalDeclaration: existingImport || null,
            newDeclaration: importDecl
        });
    }

    let hasAlreadyImported = false;

    // Handle named imports
    outer : for (const [moduleName, typeNames] of typeModulesMap.entries()) {
        for (const {name: typeName, type} of typeNames) {
            if(checkAlreadyImportTheName(typeName, type, tsChecker, program, existingImports)) {
                hasAlreadyImported = true;
                continue outer;
            }
        }

        const existingImport = existingImports.get(moduleNameToAbsolute(moduleName));

        if (typeNames.size > 0) {
            // Create import specifiers for each named import
            const importSpecifiers = Array.from(typeNames).map(info =>
                createNamedImportSpecifier(factory, info.name, true)
            );

            // Create named imports
            const namedImports = factory.createNamedImports(importSpecifiers);

            // Create import clause with named imports
            const importClause = factory.createImportClause(
                false,
                undefined,
                namedImports
            );

            // Create import declaration
            const importDecl = factory.createImportDeclaration(
                undefined,
                importClause,
                factory.createStringLiteral(moduleName)
            );

            results.push({
                originalDeclaration: existingImport || null,
                newDeclaration: importDecl
            });
        }
    }

    let scene: 'normal' | 'imported' = 'normal';
    // There has a case that the type already imported, when results's length is 0
    if(results.length === 0 && hasAlreadyImported) {
        scene = 'imported'
    }

    return {
        results,
        scene
    };
}

const checkAlreadyImportTheName = (_name: string, _type: ts.Type, tsChecker: ts.TypeChecker, program: ts.Program, existingImports: Map<string | undefined, ts.ImportDeclaration>) => {
    let alreadyHave: { dec: ts.ImportDeclaration, node: ts.Node, type: ts.Type, assignable: boolean } | undefined;
    for (let [importPath , existingImport] of existingImports) {

        let alreadyDefined: { dec: ts.ImportDeclaration, node: ts.Node, isTypeOnly: boolean, name: string } | undefined;

        if (existingImport.importClause) {
            const clauseTypeOnly = existingImport.importClause.isTypeOnly;

            if (existingImport.importClause.namedBindings) {
                if (ts.isNamedImports(existingImport.importClause.namedBindings)) {
                    const found = existingImport.importClause.namedBindings.elements.find(element => {
                        return element.name.escapedText === _name
                    });
                    if (found) alreadyDefined = {
                        dec: existingImport,
                        node: found,
                        isTypeOnly: clauseTypeOnly || found.isTypeOnly,
                        name: found.name.escapedText as string
                    };
                } else if (existingImport.importClause.namedBindings.name.escapedText === _name) {
                    alreadyDefined = {
                        dec: existingImport,
                        node: existingImport.importClause.namedBindings.name,
                        name: existingImport.importClause.namedBindings.name.escapedText,
                        isTypeOnly: clauseTypeOnly
                    };
                }
            } else if (existingImport.importClause.name && existingImport.importClause.name.escapedText === _name) {
                alreadyDefined = {
                    dec: existingImport,
                    node: existingImport.importClause.name,
                    name: existingImport.importClause.name.escapedText,
                    isTypeOnly: clauseTypeOnly
                };
            }
        }

        if (alreadyDefined) {

            let importType = tsChecker.getTypeAtLocation(alreadyDefined.node);


            const typeAssignable =  alreadyDefined.isTypeOnly
                ? tsChecker.isTypeAssignableTo(_type, importType)
                : (() => {
                    if(importPath) {
                        const sourceFile = program.getSourceFile(importPath);
                        if(sourceFile) {
                            const typeNode = getFileTopLevelTypeByName( [ alreadyDefined.name ] , sourceFile);
                            if(typeNode) {
                                return getTypeNodeIdentifierName(typeNode) === _type.symbol.name;
                            }
                        }
                    }


                    return false;
                })();


            alreadyHave = {
                ...alreadyDefined,
                type: tsChecker.getTypeAtLocation(alreadyDefined.node),
                assignable: (!!_type.aliasTypeArguments && _type.isUnionOrIntersection() && isSameDeclarationFile(_type, importType)) // type is union and generic is complex, check if is same declaration file instead.
                    || typeAssignable
            }
            break;
        }
    }

    if (alreadyHave) {
        console.log(`=> already have ${alreadyHave.node.getText()} - ${tsChecker.typeToString(alreadyHave.type)} => ${tsChecker.typeToString(_type)}`, util.inspect(alreadyHave, false, 0))
    }

    return alreadyHave;
}

const isSameDeclarationFile = (type1: ts.Type, type2: ts.Type) => {
    return type1.symbol?.declarations?.[0]?.getSourceFile().fileName === type2.symbol?.declarations?.[0]?.getSourceFile().fileName
}



const getFileTopLevelTypeByName = (typeNames: string[], sourceFile: ts.SourceFile) => {
    return ts.forEachChild(sourceFile, (node) => {
        if(!isTypeNode(node)) {
            return;
        }

        const nodeIdentifierName = getTypeNodeIdentifierName(node);
        if(typeof nodeIdentifierName !== 'string') return;

        if(typeNames.includes(nodeIdentifierName)) {
            return node;
        }
    })}

const isTypeNode = (node: ts.Node): boolean => {
    // 检查是否为类型别名声明 (type Foo = ...)
    if (ts.isTypeAliasDeclaration(node)) {
        return true;
    }

    // 检查是否为接口声明 (interface Foo {...})
    if (ts.isInterfaceDeclaration(node)) {
        return true;
    }

    // 检查是否为枚举声明 (enum Foo {...})
    if (ts.isEnumDeclaration(node)) {
        return true;
    }

    // 检查是否为类声明 (class Foo {...})
    if (ts.isClassDeclaration(node) && node.name) {
        return true;
    }

    return false;
};

const getTypeNodeIdentifierName = (node: ts.Node) => {
    if (ts.isTypeAliasDeclaration(node) ||
        ts.isInterfaceDeclaration(node) ||
        ts.isEnumDeclaration(node) ||
        ts.isClassDeclaration(node)) {
        return node.name ? node.name.text : undefined;
    }
    return undefined;
}
