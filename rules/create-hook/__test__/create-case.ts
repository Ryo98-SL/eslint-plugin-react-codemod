import fs from "fs/promises";
import path from "path";
import url from "url";

const testRootDir = path.dirname(url.fileURLToPath(import.meta.url));

const args = process.argv.slice(2);
const force = args.includes("--force");
const caseName = args.find((arg) => !arg.startsWith("--"));

if (!caseName || args.includes("--help")) {
    printUsage();
    process.exit(caseName ? 0 : 1);
}

if (!/^[a-z0-9-]+$/.test(caseName)) {
    console.error(`Invalid case name "${caseName}". Use lowercase letters, numbers, and hyphens only.`);
    process.exit(1);
}

const caseDir = path.join(testRootDir, caseName);
const fixturePaths = {
    in: path.join(caseDir, "in.tsx"),
    out: path.join(caseDir, "out.tsx"),
    test: path.join(caseDir, "index.test.ts"),
};

if (!force) {
    assertNotExists(caseDir);
}

await fs.mkdir(caseDir, {recursive: true});

const inputTemplate = createInputTemplate();
await fs.writeFile(fixturePaths.in, inputTemplate, "utf8");
await fs.writeFile(fixturePaths.out, inputTemplate, "utf8");
await fs.writeFile(fixturePaths.test, createTestTemplate(caseName), "utf8");

console.log(`Created test case at ${path.relative(process.cwd(), caseDir)}`);
console.log("Files:");
console.log(`- ${path.relative(process.cwd(), fixturePaths.in)}`);
console.log(`- ${path.relative(process.cwd(), fixturePaths.out)}`);
console.log(`- ${path.relative(process.cwd(), fixturePaths.test)}`);

async function assertNotExists(targetPath: string) {
    try {
        await fs.access(targetPath);
        console.error(`Target directory already exists: ${path.relative(process.cwd(), targetPath)}`);
        console.error("Use --force to overwrite generated files.");
        process.exit(1);
    } catch {
        return;
    }
}

function createInputTemplate() {
    return [
        'import {Dialog} from "helpers/test-helper/comps/dialog.tsx";',
        "",
        "const MyFc = () => <Dialog ref={dialogRef} />;",
        "",
    ].join("\n");
}

function createTestTemplate(caseName: string) {
    return [
        'import {beforeAll, describe, expect, test} from "vitest";',
        'import fs from "fs";',
        'import path from "path";',
        'import url from "url";',
        'import {resolveFixturePaths, runCreateHookFixture} from "../shared.ts";',
        "",
        "const testCaseDir = path.dirname(url.fileURLToPath(import.meta.url));",
        "const fixturePaths = resolveFixturePaths(testCaseDir);",
        "",
        "beforeAll(async () => {",
        "    await runCreateHookFixture(testCaseDir);",
        "});",
        "",
        `describe("create-hook ${caseName}", () => {`,
        '    test("matches snapshot", () => {',
        '        const fileContent = fs.readFileSync(fixturePaths.out, "utf8");',
        "        expect(fileContent).toMatchSnapshot();",
        "    });",
        "});",
        "",
    ].join("\n");
}

function printUsage() {
    console.log("Usage: bun run rules/create-hook/__test__/create-case.ts <case-name> [--force]");
}
