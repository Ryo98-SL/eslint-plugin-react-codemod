import * as parser from "@typescript-eslint/parser";
import {describe, expect, test} from "vitest";
import eslint from "eslint";
import fsPromises from "fs/promises";
import path from "path";
import {pkgUpSync} from "pkg-up";
import tslint from "typescript-eslint";
import url from "url";

const tsconfigRootDir = path.dirname(pkgUpSync({cwd: import.meta.url})!);
const FIXTURE_HOOK_TIMEOUT_MS = 30_000;
const FILE_FIXTURE_MODE_ENV_NAME = "ESLINT_RULE_FIXTURE_MODE";

export type FixturePaths = Record<"in" | "out", string>;
export type RuleTestConfig = Record<string, any>;
export type RuleFixtureMode = "memory" | "file";
export type RuleFixtureResult = {
    fixturePaths: FixturePaths;
    mode: RuleFixtureMode;
    output: string;
};

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
    mode: RuleFixtureMode = resolveRuleFixtureMode(),
): Promise<RuleFixtureResult> {
    const fixturePaths = resolveFixturePaths(testCaseDir);
    const linter = new eslint.ESLint({
        fix: true,
        fixTypes: ["suggestion"],
        overrideConfigFile: true,
        // @ts-ignore
        overrideConfig: tslint.config(mergeRuleTestConfig(baseConfig, overrideConfig)),
    });

    if (mode === "file") {
        await fsPromises.copyFile(fixturePaths.in, fixturePaths.out);

        const results = await linter.lintFiles([fixturePaths.out]);
        await eslint.ESLint.outputFixes(results);

        return {
            fixturePaths,
            mode,
            output: await fsPromises.readFile(fixturePaths.out, "utf8"),
        };
    }

    const input = await fsPromises.readFile(fixturePaths.in, "utf8");
    const [result] = await linter.lintText(input, {
        filePath: fixturePaths.out,
    });

    return {
        fixturePaths,
        mode,
        output: result?.output ?? result?.source ?? input,
    };
}

type DefineFixtureSnapshotTestOptions = {
    caseName: string;
    suiteName: string;
    importMetaUrl: string;
    runFixture: (testCaseDir: string) => Promise<RuleFixtureResult>;
};

export function resolveRuleFixtureMode(): RuleFixtureMode {
    return process.env[FILE_FIXTURE_MODE_ENV_NAME] === "file" ? "file" : "memory";
}

export function defineFixtureSnapshotTest({
    caseName,
    suiteName,
    importMetaUrl,
    runFixture,
}: DefineFixtureSnapshotTestOptions) {
    const testCaseDir = path.dirname(url.fileURLToPath(importMetaUrl));

    describe(`${suiteName} ${caseName}`, () => {
        test.concurrent("matches snapshot", async () => {
            const result = await runFixture(testCaseDir);
            expect(result.output).toMatchSnapshot();
        }, FIXTURE_HOOK_TIMEOUT_MS);
    });
}
