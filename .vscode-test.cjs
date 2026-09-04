const path = require("node:path");

const isAutomatedRun = process.env.DPRINT_TEST_WORKSPACE != null;
const workspaceFolder = process.env.DPRINT_TEST_WORKSPACE
  ?? path.join(__dirname, "src", "test", "fixtures", "lsp-workspace");
const developmentUserDataArg = isAutomatedRun
  ? `--user-data-dir=${path.join(workspaceFolder, ".vscode-test-user-data-development")}`
  : undefined;

const common = {
  files: "out/test/integration/**/*.test.js",
  workspaceFolder,
  version: process.env.VSCODE_TEST_VERSION ?? "stable",
  mocha: {
    timeout: 45_000,
  },
};

module.exports = [
  {
    ...common,
    label: "lsp-development",
    extensionDevelopmentPath: __dirname,
    launchArgs: [
      "--disable-extensions",
      ...(developmentUserDataArg == null ? [] : [developmentUserDataArg]),
    ],
  },
  {
    ...common,
    label: "lsp-vsix",
    // A separate development extension starts the test host; dprint itself is
    // loaded only from the installed VSIX below.
    extensionDevelopmentPath: path.join(__dirname, "src", "test", "vsix-harness"),
    installExtensions: [process.env.DPRINT_TEST_VSIX ?? ""],
    skipExtensionDependencies: true,
    launchArgs: [
      `--user-data-dir=${path.join(workspaceFolder, ".vscode-test-user-data-vsix")}`,
    ],
  },
];
