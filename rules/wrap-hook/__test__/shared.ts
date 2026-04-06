import {
    createCodemodRuleTestConfig,
    resolveFixturePaths,
    runRuleFixture,
    type RuleTestConfig,
} from "helpers/test-helper/eslint-fixture.ts";
import {wrapHook} from "../index.ts";
import type { WrapHookOptions } from "helpers";
import type {HookPattern} from "helpers/types";

export {resolveFixturePaths};

export const WRAP_HOOK_TEST_CONFIG = createCodemodRuleTestConfig("wrap-hook", wrapHook);

export async function runWrapHookFixture<H extends HookPattern = HookPattern>(
    testCaseDir: string,
    options: WrapHookOptions<H> = {},
) {
    return runRuleFixture(testCaseDir, WRAP_HOOK_TEST_CONFIG, {
        rules: {
            [`codemod/wrap-hook`]: ['warn', options],
        }
    });
}
