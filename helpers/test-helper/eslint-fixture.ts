import * as parser from "@typescript-eslint/parser";
import {beforeAll, describe, expect, test} from "vitest";
import eslint from "eslint";
import fs from "fs";
import fsPromises from "fs/promises";
import path from "path";
import {pkgUpSync} from "pkg-up";
import tslint from "typescript-eslint";
import url from "url";

const tsconfigRootDir = path.dirname(pkgUpSync({cwd: import.meta.url})!);
const FIXTURE_HOOK_TIMEOUT_MS = 30_000;

export type FixturePaths = Record<"in" | "out", string>;
export type RuleTestConfig = Record<string, any>;

export const BASE_TSX_RULE_TEST_CONFIG: RuleTestConfig = {
    languageOptions: {
        parser,
        parserOptions: {
            lib: ["dom"],
            projectService: {
                allowDefaultProject: ["*.ts*"],
            },
            ecmaFeatures: {
                jsx: true,
            },
            tsconfigRootDir,
        },
    },
    files: ["**/*.tsx"],
};

export function resolveFixturePaths(testCaseDir: string): FixturePaths {
    return {
        in: path.join(testCaseDir, "in.tsx"),
        out: path.join(testCaseDir, "out.tsx"),
    };
}

export function createCodemodRuleTestConfig(
    ruleName: string,
    rule: unknown,
    overrideConfig: RuleTestConfig = {},
): RuleTestConfig {
    return mergeRuleTestConfig(
        {
            ...BASE_TSX_RULE_TEST_CONFIG,
            plugins: {
                codemod: {
                    rules: {
                        [`${ruleName}`]: rule,
                    },
                },
            },
            rules: {
                [`codemod/${ruleName}`]: ["warn"],
            },
        },
        overrideConfig,
    );
}

export function mergeRuleTestConfig(
    baseConfig: RuleTestConfig,
    overrideConfig: RuleTestConfig = {},
): RuleTestConfig {
    return {
        ...baseConfig,
        ...overrideConfig,
        languageOptions: {
            ...baseConfig.languageOptions,
            ...overrideConfig.languageOptions,
            parserOptions: {
                ...baseConfig.languageOptions?.parserOptions,
                ...overrideConfig.languageOptions?.parserOptions,
            },
        },
        plugins: {
            ...baseConfig.plugins,
            ...overrideConfig.plugins,
            codemod: {
                ...baseConfig.plugins?.codemod,
                ...overrideConfig.plugins?.codemod,
                rules: {
                    ...baseConfig.plugins?.codemod?.rules,
                    ...overrideConfig.plugins?.codemod?.rules,
                },
            },
        },
        rules: {
            ...baseConfig.rules,
            ...overrideConfig.rules,
        },
    };
}

export async function runRuleFixture(
    testCaseDir: string,
    baseConfig: RuleTestConfig,
    overrideConfig: RuleTestConfig = {},
) {
    const fixturePaths = resolveFixturePaths(testCaseDir);
    await fsPromises.copyFile(fixturePaths.in, fixturePaths.out);

    const linter = new eslint.ESLint({
        fix: true,
        fixTypes: ["suggestion"],
        overrideConfigFile: true,
        // @ts-ignore
        overrideConfig: tslint.config(mergeRuleTestConfig(baseConfig, overrideConfig)),
    });

    const results = await linter.lintFiles([fixturePaths.out]);
    await eslint.ESLint.outputFixes(results);

    return fixturePaths;
}

type DefineFixtureSnapshotTestOptions = {
    caseName: string;
    suiteName: string;
    importMetaUrl: string;
    runFixture: (testCaseDir: string) => Promise<unknown>;
};

export function defineFixtureSnapshotTest({
    caseName,
    suiteName,
    importMetaUrl,
    runFixture,
}: DefineFixtureSnapshotTestOptions) {
    const testCaseDir = path.dirname(url.fileURLToPath(importMetaUrl));
    const fixturePaths = resolveFixturePaths(testCaseDir);

    beforeAll(async () => {
        await runFixture(testCaseDir);
    }, FIXTURE_HOOK_TIMEOUT_MS);

    describe(`${suiteName} ${caseName}`, () => {
        test("matches snapshot", () => {
            const fileContent = fs.readFileSync(fixturePaths.out, "utf8");
            expect(fileContent).toMatchSnapshot();
        });
    });
}
