const childProcess = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { runVSCodeCommand } = require("@vscode/test-electron");

const root = path.resolve(__dirname, "..");
const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), "dprint-vscode-test-"));
const pluginUrl = pathToFileURL(path.join(root, "node_modules", "@dprint", "json", "plugin.wasm")).href;
const vsixIndex = process.argv.indexOf("--vsix");
const isVsixRun = vsixIndex !== -1;
const vsixPath = isVsixRun ? process.argv[vsixIndex + 1] : undefined;
let cleaned = false;

if (isVsixRun && (vsixPath == null || !fs.existsSync(vsixPath))) {
  throw new Error("Pass an existing VSIX path after --vsix.");
}

function cleanup() {
  if (cleaned) {
    return;
  }
  cleaned = true;
  fs.rmSync(testRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
}

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => {
    cleanup();
    process.exit(128);
  });
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

async function main() {
  try {
    for (const backend of ["legacy", "lsp"]) {
      for (const hasWorkspace of [true, false]) {
        await runScenario(backend, hasWorkspace);
      }
    }
  } finally {
    cleanup();
  }
}

async function runScenario(backend, hasWorkspace) {
  const name = `${backend}-${hasWorkspace ? "workspace" : "empty"}`;
  const scenarioRoot = path.join(testRoot, name);
  const workspace = path.join(scenarioRoot, "workspace");
  const ancestorProject = path.join(scenarioRoot, "ancestor-project");
  const globalFiles = path.join(scenarioRoot, "global-files");
  const missingFiles = path.join(scenarioRoot, "missing-files");
  const globalConfigDir = path.join(scenarioRoot, "global-config");
  // Keep profiles close to the temporary root: VS Code's IPC socket path must
  // fit macOS's 103-character limit. Each scenario still needs its own profile.
  const userDataDir = path.join(testRoot, `u${backend === "legacy" ? "0" : "1"}${hasWorkspace ? "w" : "e"}`);
  const extensionsDir = path.join(scenarioRoot, "extensions");

  for (
    const directory of [
      workspace,
      ancestorProject,
      globalFiles,
      missingFiles,
      globalConfigDir,
      extensionsDir,
      path.join(userDataDir, "User"),
    ]
  ) {
    fs.mkdirSync(directory, { recursive: true });
  }

  writeConfig(path.join(workspace, "dprint.json"), 2);
  writeConfig(path.join(ancestorProject, "dprint.json"), 4);
  fs.writeFileSync(
    path.join(userDataDir, "User", "settings.json"),
    JSON.stringify({
      "dprint.experimentalLsp": backend === "lsp",
      "editor.defaultFormatter": "dprint.dprint",
      "editor.formatOnSave": true,
      "files.eol": "\n",
    }),
  );

  if (hasWorkspace) {
    fs.mkdirSync(path.join(workspace, ".vscode"), { recursive: true });
    fs.writeFileSync(
      path.join(workspace, ".vscode", "settings.json"),
      JSON.stringify({
        "dprint.experimentalLsp": backend === "lsp",
        "editor.defaultFormatter": "dprint.dprint",
        "editor.formatOnSave": true,
        "files.eol": "\n",
      }),
    );
    fs.mkdirSync(path.join(workspace, "node_modules", "@dprint"), { recursive: true });
    fs.cpSync(
      path.join(root, "node_modules", "@dprint"),
      path.join(workspace, "node_modules", "@dprint"),
      { recursive: true },
    );
  }

  if (vsixPath != null) {
    await runVSCodeCommand(
      [
        `--extensions-dir=${extensionsDir}`,
        `--user-data-dir=${userDataDir}`,
        "--install-extension",
        path.resolve(vsixPath),
        "--force",
      ],
      { version: process.env.VSCODE_TEST_VERSION ?? "stable" },
    );
  }

  const cliPath = path.join(path.dirname(require.resolve("@vscode/test-cli")), "bin.mjs");
  const result = childProcess.spawnSync(
    process.execPath,
    [cliPath, "--config", path.join(root, ".vscode-test.cjs"), "--label", name],
    {
      cwd: root,
      env: {
        ...process.env,
        DPRINT_CONFIG_DIR: globalConfigDir,
        DPRINT_TEST_ANCESTOR_PROJECT: ancestorProject,
        DPRINT_TEST_BACKEND: backend,
        DPRINT_TEST_EXTENSIONS_DIR: extensionsDir,
        DPRINT_TEST_GLOBAL_CONFIG_DIR: globalConfigDir,
        DPRINT_TEST_GLOBAL_FILES: globalFiles,
        DPRINT_TEST_HAS_WORKSPACE: String(hasWorkspace),
        DPRINT_TEST_LABEL: name,
        DPRINT_TEST_MISSING_FILES: missingFiles,
        DPRINT_TEST_PLUGIN_URL: pluginUrl,
        DPRINT_TEST_USER_DATA_DIR: userDataDir,
        DPRINT_TEST_WORKSPACE: workspace,
        ...(vsixPath == null ? {} : { DPRINT_TEST_VSIX: path.resolve(vsixPath) }),
      },
      stdio: "inherit",
    },
  );
  if (result.error != null) {
    throw result.error;
  }
  if (result.status !== 0) {
    process.exitCode = result.status ?? 1;
    throw new Error(`VS Code integration scenario ${name} failed.`);
  }
}

function writeConfig(filePath, indentWidth) {
  fs.writeFileSync(filePath, JSON.stringify({
    indentWidth,
    includes: ["**/*.dprint-test"],
    plugins: [pluginUrl],
    json: {
      associations: ["*.dprint-test"],
    },
  }));
}
