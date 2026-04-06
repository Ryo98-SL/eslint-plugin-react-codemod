import type {JSONSchema4} from "@typescript-eslint/utils/json-schema";

export const SET_STATE_TYPE_STRING_PATTERN = /Dispatch<SetStateAction<.*>>/
export const REF_PATTERN = /(RefObject|MutableRefObject)<.*>/
export const HOOK_CONFIG_SHAPE: Record<string, JSONSchema4> = {
        "prefer": {
            type: "string",
        },
        "activateWithComment": {
            type: "boolean",
        },
        "alternates": {
            type: "array",
            items: {
                type: "object",
                properties: {
                    "isDefaultExport": {
                        type: "boolean",
                    },
                    "withDepList": {
                        type: "boolean",
                    },
                    "hookName": {
                        type: "string",
                    },
                    "hookModulePath": {
                        type: "string",
                    }
                }
            }
        }
    }