import {defineFixtureSnapshotTest} from "helpers/test-helper/eslint-fixture.ts";
import {runWrapHookFixture} from "../shared.ts";
import {reactCodemodPresets as presets} from "../../../../presets/index.ts";

defineFixtureSnapshotTest({
    caseName: "mui-preset",
    suiteName: "wrap-hook",
    importMetaUrl: import.meta.url,
    runFixture: (testCaseDir) => runWrapHookFixture(testCaseDir, presets.mui().wrapHook?.[1] ?? {}),
});
