import {
    createCodemodRuleTestConfig,
    resolveFixturePaths,
    runRuleFixture,
    type RuleTestConfig,
} from "helpers/test-helper/eslint-fixture.ts";
import {createHook} from "../index.ts";
export {resolveFixturePaths};

export const CREATE_HOOK_TEST_CONFIG = createCodemodRuleTestConfig("create-hook", createHook);

export async function runCreateHookFixture(
    testCaseDir: string,
    overrideConfig: RuleTestConfig = {},
) {
    return runRuleFixture(testCaseDir, CREATE_HOOK_TEST_CONFIG, overrideConfig);
}
