import * as vscode from "vscode";
import type { ApprovedConfigPaths } from "../ApprovedConfigPaths";
import type { ExtensionBackend } from "../ExtensionBackend";
import type { Logger } from "../logger";
import { ActivatedDisposables, HttpsTextDownloader, ObjectDisposedError } from "../utils";
import { ConfigJsonSchemaProvider } from "./ConfigJsonSchemaProvider";
import { WorkspaceService } from "./WorkspaceService";

export function activateLegacy(
  logger: Logger,
  approvedPaths: ApprovedConfigPaths,
): ExtensionBackend {
  const resourceDisposables = new ActivatedDisposables(logger);
  const workspaceService = new WorkspaceService({
    approvedPaths,
    logger,
  });
  resourceDisposables.push(workspaceService);
  resourceDisposables.push(vscode.languages.registerDocumentFormattingEditProvider(
    { scheme: "file" },
    workspaceService,
  ));

  // todo: add an "onDidOpen" for dprint.json and use the appropriate EditorInfo
  // for ConfigJsonSchemaProvider based on the file that's shown
  const configSchemaProvider = new ConfigJsonSchemaProvider(logger, new HttpsTextDownloader());
  resourceDisposables.push(
    vscode.workspace.registerTextDocumentContentProvider(ConfigJsonSchemaProvider.scheme, configSchemaProvider),
  );

  return {
    isLsp: false,
    async reInitialize() {
      try {
        const folderInfos = await workspaceService.initializeFolders();
        configSchemaProvider.setFolderInfos(folderInfos);
        if (folderInfos.length === 0) {
          logger.logInfo("Configuration file not found.");
        }
      } catch (err) {
        if (!(err instanceof ObjectDisposedError)) {
          logger.logError("Error initializing:", err);
        }
      }
      logger.logDebug("Initialized legacy backend.");
    },
    dispose() {
      resourceDisposables.dispose();
      logger.logDebug("Disposed legacy backend.");
    },
  };
}
