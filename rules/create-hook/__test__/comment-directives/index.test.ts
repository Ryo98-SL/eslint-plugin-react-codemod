import {defineFixtureSnapshotTest} from "helpers/test-helper/eslint-fixture.ts";
import {runCreateHookFixture} from "../shared.ts";

defineFixtureSnapshotTest({
    caseName: "comment-directives",
    suiteName: "create-hook",
    importMetaUrl: import.meta.url,
    runFixture: (testCaseDir) => runCreateHookFixture(testCaseDir, {
        rules: {
            "codemod/create-hook": ["warn", {
                allowAttributes: ["*"],
                commentDirectives: {
                    prefix: "react-codemod",
                },
            }],
        },
    }),
});
