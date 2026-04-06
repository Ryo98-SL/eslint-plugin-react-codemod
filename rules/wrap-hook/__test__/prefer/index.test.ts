import {defineFixtureSnapshotTest} from "helpers/test-helper/eslint-fixture.ts";
import {runWrapHookFixture} from "../shared.ts";


defineFixtureSnapshotTest({
    caseName: "comment",
    suiteName: "wrap-hook",
    importMetaUrl: import.meta.url,
    runFixture: (testCaseDir) => runWrapHookFixture(testCaseDir, {
                 useCallback: { 
                    prefer: "useCallbackProxy",
                    alternates: [
                        {
                            hookName: "useCallbackProxy",
                            hookModulePath: "react-dummy",
                            isDefaultExport: false,
                            withDepList: true
                        }
                    ]
                  },
                 useMemo: {
                    prefer: "useMemoProxy",
                    alternates: [
                        {
                            hookName: "useMemoProxy",
                            hookModulePath: "react-dummy",
                            isDefaultExport: false,
                            withDepList: true
                        }
                    ]
                 }
                 }),
});
