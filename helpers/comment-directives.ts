import type {TSESTree} from "@typescript-eslint/typescript-estree";
import type {CommentDirectiveOptions} from "./types/index.ts";

type CommentSourceCode = {
    getCommentsBefore(node: TSESTree.Node): TSESTree.Comment[];
};

type HookDirectiveCandidate = {
    hookName: string;
};

type CommentDirectiveMatch<T extends HookDirectiveCandidate> =
    | {
        kind: "ignore";
        comment: TSESTree.Comment;
    }
    | {
        kind: "hook";
        comment: TSESTree.Comment;
        hook: T;
    };

type ParseAdjacentCommentDirectiveOptions<T extends HookDirectiveCandidate> = {
    sourceCode: CommentSourceCode;
    node: TSESTree.Node;
    hookCandidates: T[];
    directives?: CommentDirectiveOptions;
};

const escapeRegExp = (value: string) => {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

const normalizeCommentValue = (value: string) => {
    return value.trim().replace(/^-+\s*/, "");
};

const createShortCommandRegExp = (command: string) => {
    return new RegExp(`^${escapeRegExp(command)}(?:\\s|$)`);
};

const createPrefixedCommandRegExp = (prefix: string, command: string) => {
    return new RegExp(`^${escapeRegExp(prefix)}\\s*:\\s*${escapeRegExp(command)}(?:\\s|$)`);
};

const matchesDirectiveCommand = (
    commentValue: string,
    command: string,
    directives?: CommentDirectiveOptions,
) => {
    if (createShortCommandRegExp(command).test(commentValue)) {
        return true;
    }

    if (!directives?.prefix) {
        return false;
    }

    return createPrefixedCommandRegExp(directives.prefix, command).test(commentValue);
};

export const parseAdjacentCommentDirective = <T extends HookDirectiveCandidate>({
    sourceCode,
    node,
    hookCandidates,
    directives,
}: ParseAdjacentCommentDirectiveOptions<T>): CommentDirectiveMatch<T> | null => {
    const comments = sourceCode.getCommentsBefore(node);
    const closestComment = comments[comments.length - 1];
    if (!closestComment || closestComment.loc.end.line + 1 !== node.loc.start.line) {
        return null;
    }

    const commentValue = normalizeCommentValue(closestComment.value);
    if (matchesDirectiveCommand(commentValue, "ignore", directives)) {
        return {
            kind: "ignore",
            comment: closestComment,
        };
    }

    for (const candidate of hookCandidates) {
        if (!matchesDirectiveCommand(commentValue, candidate.hookName, directives)) {
            continue;
        }

        return {
            kind: "hook",
            comment: closestComment,
            hook: candidate,
        };
    }

    return null;
};
