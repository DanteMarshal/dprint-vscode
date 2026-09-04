import * as assert from "node:assert/strict";
import { TextDecoder, TextEncoder } from "node:util";
import * as vscode from "vscode";

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const extensionId = "dprint.dprint";
const formattedJson = "{\n  \"test\": 5\n}\n";
const unformattedJson = "{\n       \"test\":     5\n}";
const generatedFileNames = [
  "format-command.dprint-test",
  "format-on-save.dprint-test",
  "restart.dprint-test",
  "configuration-change.dprint-test",
];

suite("LSP integration", () => {
  const workspace = vscode.workspace.workspaceFolders?.[0];
  if (workspace == null) {
    throw new Error("The test runner must open the LSP fixture workspace.");
  }
  const workspaceUri = workspace.uri;
  let originalConfig: Uint8Array | undefined;

  suiteSetup(async () => {
    const extension = vscode.extensions.getExtension(extensionId);
    assert.ok(extension, `Expected ${extensionId} to be installed.`);
    await extension.activate();
    originalConfig = await vscode.workspace.fs.readFile(vscode.Uri.joinPath(workspaceUri, "dprint.json"));
    assert.equal(vscode.workspace.getConfiguration("dprint").get("experimentalLsp"), true);
    await vscode.workspace.getConfiguration("editor").update(
      "defaultFormatter",
      extensionId,
      vscode.ConfigurationTarget.Workspace,
    );
    await vscode.workspace.getConfiguration("editor").update(
      "formatOnSave",
      true,
      vscode.ConfigurationTarget.Workspace,
    );
  });

  suiteTeardown(async () => {
    await vscode.commands.executeCommand("workbench.action.closeAllEditors");
    await Promise.all(generatedFileNames.map(async name => {
      try {
        await vscode.workspace.fs.delete(vscode.Uri.joinPath(workspaceUri, name));
      } catch {
        // The file may not have been created if its test failed during setup.
      }
    }));
    if (originalConfig != null) {
      await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(workspaceUri, "dprint.json"), originalConfig);
    }
  });

  test("formats a document on save", async () => {
    const document = await createDocument("format-on-save.dprint-test", "");
    await waitForFormattedDocument(document, async () => {
      await vscode.window.showTextDocument(document, vscode.ViewColumn.One, false);
      await replaceDocumentText(document, unformattedJson);
      await vscode.commands.executeCommand("workbench.action.files.save");
    });
  });

  test("formats a document with Format Document", async () => {
    const document = await createDocument("format-command.dprint-test", unformattedJson);
    await waitForFormattedDocument(document, async () => {
      await vscode.window.showTextDocument(document, vscode.ViewColumn.One, false);
      await vscode.commands.executeCommand("editor.action.formatDocument");
    });
  });

  test("formats after the restart command", async () => {
    await vscode.commands.executeCommand("dprint.restart");
    const document = await createDocument("restart.dprint-test", unformattedJson);
    await waitForFormattedDocument(document, async () => {
      await vscode.window.showTextDocument(document, vscode.ViewColumn.One, false);
      await vscode.commands.executeCommand("editor.action.formatDocument");
    });
  });

  test("reinitializes after its configuration file changes", async () => {
    const configUri = vscode.Uri.joinPath(workspaceUri, "dprint.json");
    const config = decoder.decode(await vscode.workspace.fs.readFile(configUri));
    await vscode.workspace.fs.writeFile(configUri, encoder.encode(`${config}\n`));

    const document = await createDocument("configuration-change.dprint-test", unformattedJson);
    await waitForFormattedDocument(document, async () => {
      await vscode.window.showTextDocument(document, vscode.ViewColumn.One, false);
      await vscode.commands.executeCommand("editor.action.formatDocument");
    });
  });

  async function createDocument(name: string, text: string) {
    const uri = vscode.Uri.joinPath(workspaceUri, name);
    await vscode.workspace.fs.writeFile(uri, encoder.encode(text));
    return await vscode.workspace.openTextDocument(uri);
  }

  async function replaceDocumentText(document: vscode.TextDocument, text: string) {
    const edit = new vscode.WorkspaceEdit();
    edit.replace(document.uri, fullDocumentRange(document), text);
    assert.equal(await vscode.workspace.applyEdit(edit), true);
  }

  async function waitForFormattedDocument(document: vscode.TextDocument, action: () => Promise<void>) {
    const deadline = Date.now() + 30_000;
    let lastText = document.getText();
    while (Date.now() < deadline) {
      await action();
      lastText = document.getText();
      if (lastText === formattedJson) {
        return;
      }
      await delay(100);
    }
    assert.fail(`Timed out waiting for LSP formatting. Last document text:\n${lastText}`);
  }

  function fullDocumentRange(document: vscode.TextDocument) {
    const lastLine = document.lineAt(document.lineCount - 1);
    return new vscode.Range(0, 0, document.lineCount - 1, lastLine.text.length);
  }
});

function delay(ms: number) {
  return new Promise<void>(resolve => setTimeout(resolve, ms));
}
