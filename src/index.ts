import {defineConfig, defineMemoRuleConfig, reactCodemodConfig} from "./config.ts";
import {composeReactCodemodOptions, reactCodemodPresets} from "../presets/index.ts";

type ReactCodemodApi = typeof reactCodemodConfig & {
    presets: typeof reactCodemodPresets;
    compose: typeof composeReactCodemodOptions;
    defineConfig: typeof defineConfig;
    defineMemoRuleConfig: typeof defineMemoRuleConfig;
};

const reactCodemod: ReactCodemodApi = Object.assign(reactCodemodConfig, {
    presets: reactCodemodPresets,
    compose: composeReactCodemodOptions,
    defineConfig,
    defineMemoRuleConfig,
});

export default reactCodemod;
export {
    composeReactCodemodOptions as compose,
    defineConfig,
    defineMemoRuleConfig,
    reactCodemodConfig,
    reactCodemodPresets as presets,
};
