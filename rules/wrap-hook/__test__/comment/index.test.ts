import {defineFixtureSnapshotTest} from "helpers/test-helper/eslint-fixture.ts";
import {runWrapHookFixture} from "../shared.ts";
import { useCallback } from "react";
import { wrapHook } from "../../index.ts";

defineFixtureSnapshotTest({
    caseName: "comment",
    suiteName: "wrap-hook",
    importMetaUrl: import.meta.url,
    runFixture: (testCaseDir) => runWrapHookFixture(testCaseDir, { useCallback: { commentOnly: true }, useMemo: { commentOnly: true } }),
});
