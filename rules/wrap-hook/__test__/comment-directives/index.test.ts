import {defineFixtureSnapshotTest} from "helpers/test-helper/eslint-fixture.ts";
import {runWrapHookFixture} from "../shared.ts";
import {composeReactCodemodOptions as compose, reactCodemodPresets as presets} from "../../../../presets/index.ts";

defineFixtureSnapshotTest({
    caseName: "comment-directives",
    suiteName: "wrap-hook",
    importMetaUrl: import.meta.url,
    runFixture: (testCaseDir) => {
        const options = compose(
            presets.ahooks(),
            {
                wrapHook: ["warn", {
                    commentDirectives: {
                        prefix: "react-codemod",
                    },
                    useCallback: {
                        commentOnly: true,
                    },
                    useMemo: {
                        commentOnly: true,
                    },
                }],
            },
        ).wrapHook?.[1] ?? {};

        return runWrapHookFixture(testCaseDir, options);
    },
});
