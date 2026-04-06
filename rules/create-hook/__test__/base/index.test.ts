import {defineFixtureSnapshotTest} from "helpers/test-helper/eslint-fixture.ts";
import {runCreateHookFixture} from "../shared.ts";

defineFixtureSnapshotTest({
    caseName: "base",
    suiteName: "create-hook",
    importMetaUrl: import.meta.url,
    runFixture: (testCaseDir) => runCreateHookFixture(testCaseDir),
});
