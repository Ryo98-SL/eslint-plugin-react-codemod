import {FlatConfig} from "@typescript-eslint/utils/ts-eslint";
import * as parser from "@typescript-eslint/parser";
import {wrapHook} from "../rules/wrap-hook";
import {createHook} from "../rules/create-hook";
import fs from "fs";
import path from "path";
import { ROOT_DIR } from "../paths";

const pkg: { name: string, version: string } = JSON.parse(
    fs.readFileSync(path.join(ROOT_DIR, "package.json"), "utf8"),
);
const allRules: FlatConfig.Plugin['rules'] = {
    "wrap-hook": wrapHook,
    "create-hook": createHook,
}

const plugin = {
    rules: allRules,
    meta: {
        name: pkg.name,
        version: pkg.version,
    }
} satisfies FlatConfig.Plugin;

export const BaseConfig: FlatConfig.Config = {
    plugins: {
        "react-codemod": plugin,
    },
    rules: {
        "react-codemod/wrap-hook": ["warn"],
        "react-codemod/create-hook": ["warn"],
    },
    files: ["**/*.tsx", "!**/*.test.tsx"],
    languageOptions: {
        parser: parser,
        parserOptions: {
            lib: ['dom'],
            projectService: {
                allowDefaultProject: ['*.tsx', "*.jsx"],
            },
            ecmaFeatures: {
                jsx: true,
            },
        },
    }
}

export {plugin}
export default plugin;