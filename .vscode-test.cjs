const path = require("node:path");

const root = __dirname;
const isVsixRun = process.env.DPRINT_TEST_VSIX != null;
const workspaceFolder = process.env.DPRINT_TEST_HAS_WORKSPACE === "true"
  ? process.env.DPRINT_TEST_WORKSPACE
  : undefined;

module.exports = [{
  label: process.env.DPRINT_TEST_LABEL ?? "integration",
  files: "out/test/integration/formatting.test.js",
  ...(workspaceFolder == null ? {} : { workspaceFolder }),
  version: process.env.VSCODE_TEST_VERSION ?? "stable",
  mocha: {
    timeout: 45_000,
  },
  extensionDevelopmentPath: isVsixRun
    ? path.join(root, "src", "test", "vsix-harness")
    : root,
  ...(isVsixRun ? { skipExtensionDependencies: true } : {}),
  launchArgs: [
    `--user-data-dir=${process.env.DPRINT_TEST_USER_DATA_DIR}`,
    `--extensions-dir=${process.env.DPRINT_TEST_EXTENSIONS_DIR}`,
    ...(!isVsixRun ? ["--disable-extensions"] : []),
  ],
}];
