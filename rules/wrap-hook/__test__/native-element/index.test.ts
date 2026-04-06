import {defineFixtureSnapshotTest} from "helpers/test-helper/eslint-fixture.ts";
import {runWrapHookFixture} from "../shared.ts";

defineFixtureSnapshotTest({
    caseName: "native-element",
    suiteName: "wrap-hook",
    importMetaUrl: import.meta.url,
    runFixture: (testCaseDir) => runWrapHookFixture(testCaseDir),
});
