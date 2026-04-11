import {
    analyzeTypeAndCreateImports,
    getExtractType,
    getTypeNodeForProp,
    type TsService,
} from "helpers";
import type {ImportUpdateResult} from "helpers/types";
import ts, {TypeFlags} from "typescript";
import type {TSESTree} from "@typescript-eslint/typescript-estree";
import type {NormalizedHookAlternate} from "./types.ts";

type InferHookTypeParams = {
    attrName: string;
    componentName: string;
    currentFilePath: string;
    filename: string;
    hook: NormalizedHookAlternate;
    node: TSESTree.JSXAttribute;
    scopeManager: import("@typescript-eslint/utils/ts-eslint").Scope.ScopeManager;
    shouldAddTypes: boolean;
    sourceFile: ts.SourceFile | undefined;
    tsChecker: ts.TypeChecker;
    tsConfigPath: string | null;
    tsService: TsService;
};

type InferHookTypeResult = {
    importUpdates: ImportUpdateResult[];
    inferredType: ts.Type | ts.TypeNode | undefined;
};

export const inferCreateHookType = ({
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
}: InferHookTypeParams): InferHookTypeResult => {
    if (!shouldAddTypes || !sourceFile) {
        return {
            importUpdates: [],
            inferredType: undefined,
        };
    }

    const resolvedTypeInfo = getTypeNodeForProp(
        node,
        attrName,
        componentName,
        true,
        true,
        tsService,
        filename,
    );

    if (!resolvedTypeInfo) {
        return {
            importUpdates: [],
            inferredType: undefined,
        };
    }

    let inferredType: ts.Type | ts.TypeNode | undefined;

    if (attrName === "ref") {
        // get type argument "T" of Ref<T>, skipping null / undefined branches
        // @ts-ignore current helper returns a union-like origin for ref props
        const [typeArgument] = (resolvedTypeInfo.type.origin as ts.UnionType).types.filter((type) => {
            return !(type.flags & TypeFlags.Undefined) && !(type.flags & TypeFlags.Null);
        });

        if (!typeArgument) {
            return {
                importUpdates: [],
                inferredType: undefined,
            };
        }

        inferredType = typeArgument.aliasTypeArguments?.[0];
    } else {
        inferredType = resolvedTypeInfo.type;
    }

    if (!inferredType) {
        return {
            importUpdates: [],
            inferredType: undefined,
        };
    }

    const {
        results: importUpdates,
        scene: importScene,
    } = analyzeTypeAndCreateImports(
        inferredType,
        tsService,
        tsChecker,
        sourceFile,
        tsService.program,
        scopeManager,
        currentFilePath,
        tsConfigPath,
        {resolveToRelativePath: true},
    );

    const typeHasImported = importScene !== "imported";
    if (!importUpdates.length && typeHasImported && shouldAddTypes) {
        inferredType = getExtractType(componentName, attrName, inferredType, hook.hookName, resolvedTypeInfo, tsService, tsChecker);
    }

    return {
        importUpdates,
        inferredType,
    };
};
