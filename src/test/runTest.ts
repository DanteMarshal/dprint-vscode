import * as fs from "node:fs";
import * as path from "node:path";
import * as process from "node:process";

import { runTests } from "@vscode/test-electron";

async function main() {
  try {
    // The folder containing the Extension Manifest package.json
    // Passed to `--extensionDevelopmentPath`
    const extensionDevelopmentPath = path.resolve(__dirname, "../../");

    // The path to test runner
    // Passed to --extensionTestsPath
    const extensionTestsPath = path.resolve(__dirname, "./suite/index");

    // Open the test workspace when VS Code starts. Opening a folder from a
    // running extension test reloads the extension host.
    const testWorkspacePath = path.join(extensionDevelopmentPath, "temp");
    fs.mkdirSync(testWorkspacePath, { recursive: true });

    // Download VS Code, unzip it and run the integration test
    await runTests({
      extensionDevelopmentPath,
      extensionTestsPath,
      launchArgs: [testWorkspacePath, "--disable-extensions"],
    });
  } catch (_err) {
    console.error("Failed to run tests");
    process.exit(1);
  }
}

main();
