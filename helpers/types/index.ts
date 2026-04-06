import {AST_NODE_TYPES, type ParserServicesWithTypeInformation, TSESTree} from "@typescript-eslint/typescript-estree";
import type {RuleContext} from "@typescript-eslint/utils/ts-eslint";
import ts from "typescript";

export interface ModuleInfo {
    moduleName: string;
    isDefaultExport?: boolean;
}

export interface RegExpConfig {
    pattern: string;
    flags?: string;
}

export type TsService = ParserServicesWithTypeInformation;
export type TypedRuleContext<T extends string> =  Readonly<RuleContext<T, any[]>>;

type MapNodeUtil<N extends TSESTree.Node, T extends AST_NODE_TYPES> = N extends { type: T } ? N : never;
type MapNodeWithType<T extends AST_NODE_TYPES> = {
    [K in T]: MapNodeUtil<TSESTree.Node, K>
}[T];
export type MapNodeWithTypes<T extends AST_NODE_TYPES | (readonly AST_NODE_TYPES[])> = T extends AST_NODE_TYPES ?
    MapNodeWithType<T>
    : T extends readonly AST_NODE_TYPES[] ? MapNodeWithType<T[number]> : never;
type DeclarationNodeType = TSESTree.VariableDeclarator | TSESTree.FunctionDeclaration | TSESTree.ClassDeclaration

/**
 * 导入声明更新结果接口，包含原始声明和新的声明
 */
export interface ImportUpdateResult {
    /** 原始的导入声明，如果是新创建的则为null */
    originalDeclaration: ts.ImportDeclaration | null;
    /** 更新后或新创建的导入声明 */
    newDeclaration: ts.ImportDeclaration;
}

/**
 * 表示导入更新的结果
 */
export interface ImportUpdateResult {
    originalDeclaration: ts.ImportDeclaration | null;
    newDeclaration: ts.ImportDeclaration;
}

export type FixScene = 'top-level-constant' | 'hook';
export type MutableArray<T extends readonly any[]> = T extends readonly (infer R)[] ? R[] : T;
export type ResolvedCompPropTypeInfo = { type: ts.Type, propsType: ts.Type };

export interface WrapHookOptions<H extends HookPattern = HookPattern> {
    typeDefinitions?: boolean;
    ignoredComponents?: (string | RegExpConfig)[];
    declarationsPosition?: 'start' | 'end';
    checkFunction?: boolean;
    checkArray?: boolean;
    checkReturnValueOfCalling?: boolean;
    checkNewExpression?: boolean;
    checkRegExp?: boolean;
    useMemo?: WrapHookConfig<H, 'useMemo'>;
    useCallback?: WrapHookConfig<H, 'useCallback'>;
}

export interface CreateHookRuleOptions {
    allowAttributes?: (string | RegExpConfig)[];
    ignoredComponents?: (string | RegExpConfig)[];
    alternates?: HookAlternate[],
    typeDefinitions?: boolean
}

export type HookPattern = `use${string}`;

interface HookConfig<H extends HookPattern = HookPattern> {
    hookName: H,
    hookModulePath: string,
    isDefaultExport: boolean,
}

export interface WrapAlternate<H extends HookPattern = HookPattern> extends HookConfig<H> {
    withDepList: boolean,
}

export interface BaseRefAlternate<H extends HookPattern = HookPattern> extends HookConfig<H> {
    matchPattern: string | {pattern: string, flags?: string};
}

export interface CreateAlternateStateKind<H extends HookPattern = HookPattern> extends BaseRefAlternate<H> {
    kind: 'state';
    stateVariableNamePattern: string;
}

export interface CreateAlternateReferenceKind<H extends HookPattern = HookPattern> extends BaseRefAlternate<H> {
    kind: 'reference';
}

export type HookAlternate<H extends HookPattern = HookPattern> = CreateAlternateStateKind<H> | CreateAlternateReferenceKind<H>;

export type WrapHookConfig<H extends HookPattern = HookPattern, T extends string = string> = {
    prefer?: NoInfer<H | T>;
    commentOnly?: boolean;
    alternates?: WrapAlternate<H>[];
};
export type CreateHookConfig<H extends HookPattern = HookPattern> = {
    alternates?: HookAlternate<H>[]
}