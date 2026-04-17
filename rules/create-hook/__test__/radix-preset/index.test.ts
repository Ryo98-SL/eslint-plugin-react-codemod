import {defineFixtureSnapshotTest} from "helpers/test-helper/eslint-fixture.ts";
import {runCreateHookFixture} from "../shared.ts";
import {reactCodemodPresets as presets} from "../../../../presets/index.ts";

defineFixtureSnapshotTest({
    caseName: "radix-preset",
    suiteName: "create-hook",
    importMetaUrl: import.meta.url,
    runFixture: (testCaseDir) => runCreateHookFixture(testCaseDir, {
        rules: {
            "codemod/create-hook": presets.radix().createHook ?? ["warn"],
        },
    }),
});
