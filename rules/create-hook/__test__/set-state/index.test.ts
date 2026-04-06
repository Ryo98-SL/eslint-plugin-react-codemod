import {defineFixtureSnapshotTest} from "helpers/test-helper/eslint-fixture.ts";
import {runCreateHookFixture} from "../shared.ts";
import {createHook} from "../../index.ts";

defineFixtureSnapshotTest({
    caseName: "set-state",
    suiteName: "create-hook",
    importMetaUrl: import.meta.url,
    runFixture: (testCaseDir) => runCreateHookFixture(testCaseDir, {
        plugins: {
            codemod: {
                rules: {
                    "create-hook": createHook
                }
            }
        },
        rules: {
            "codemod/create-hook": ['warn', { allowAttributes: ['*'] }]
        }
    }),
});
