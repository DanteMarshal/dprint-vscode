import * as vscode from "vscode";
import type { ApprovedConfigPaths } from "../ApprovedConfigPaths";
import type { ConfigJsonSchemaProvider } from "../ConfigJsonSchemaProvider";
import type { ExtensionBackend } from "../ExtensionBackend";
import type { Logger } from "../logger";
import { ActivatedDisposables, delay, ObjectDisposedError } from "../utils";
import { CoalescingQueue } from "../utils/CoalescingQueue";
import { WorkspaceService } from "./WorkspaceService";

/** The scheme of user data files such as the user settings.json. */
const USER_DATA_SCHEME = "vscode-userdata";

export function activateLegacy(
  logger: Logger,
  approvedPaths: ApprovedConfigPaths,
  configSchemaProvider: ConfigJsonSchemaProvider,
): ExtensionBackend {
  const resourceDisposables = new ActivatedDisposables(logger);
  const initializationDisposables = new ActivatedDisposables(logger);
  const workspaceService = new WorkspaceService({
    approvedPaths,
    logger,
    onAncestorConfigFileCreatedOrDeleted: reInitialize,
    onAncestorConfigFileChanged: scheduleConfigFileRefresh,
    onLooseFolderChanged: scheduleUserDataFilePathsUpdate,
  });
  resourceDisposables.push(workspaceService);

  // todo: add an "onDidOpen" for dprint.json and use the appropriate EditorInfo
  // for ConfigJsonSchemaProvider based on the file that's shown
  let disposed = false;
  let registrationKey: string | undefined;
  let registrationUpdate = Promise.resolve();
  // coalesced because saving a config file often causes multiple change events
  const configFileRefreshQueue = new CoalescingQueue({
    action: refreshAfterConfigFileChange,
    wait: () => delay(100),
  });
  let userDataFilePaths: string[] = [];
  let userDataFilePathsUpdate = Promise.resolve();

  // update the user data files (ex. the user settings.json) to format when the visible editors change
  resourceDisposables.push(vscode.window.onDidChangeVisibleTextEditors(() => scheduleUserDataFilePathsUpdate()));

  return {
    isLsp: false,
    reInitialize,
    onConfigFileChanged: scheduleConfigFileRefresh,
    dispose() {
      disposed = true;
      initializationDisposables.dispose();
      resourceDisposables.dispose();
      logger.logDebug("Disposed legacy backend.");
    },
  };

  async function reInitialize() {
    try {
      const folderInfos = await workspaceService.initializeFolders();
      configSchemaProvider.setEditorInfos(folderInfos.map(info => info.editorInfo));
      await scheduleFormattingRegistrationUpdate();
      // don't wait for this because it may need to start dprint for a config outside the workspace
      scheduleUserDataFilePathsUpdate();
      if (folderInfos.length === 0) {
        logger.logInfo("Configuration file not found.");
      }
    } catch (err) {
      if (!(err instanceof ObjectDisposedError)) {
        logger.logError("Error initializing:", err);
      }
    }
    logger.logDebug("Initialized legacy backend.");
  }

  function scheduleConfigFileRefresh() {
    return configFileRefreshQueue.schedule();
  }

  /** Refreshes the plugin information after a config file's contents changed. */
  async function refreshAfterConfigFileChange() {
    try {
      const folderInfos = await workspaceService.refreshFolders();
      configSchemaProvider.setEditorInfos(folderInfos.map(info => info.editorInfo));
      await scheduleFormattingRegistrationUpdate();
      scheduleUserDataFilePathsUpdate();
      logger.logDebug("Refreshed the plugin information.");
    } catch (err) {
      if (!(err instanceof ObjectDisposedError)) {
        logger.logError("Error refreshing:", err);
      }
    }
  }

  // Updates run one at a time so concurrent changes don't register providers twice.
  function scheduleFormattingRegistrationUpdate() {
    registrationUpdate = registrationUpdate
      .then(() => updateFormattingRegistration())
      .catch(err => logger.logError("Error updating formatting registration:", err));
    return registrationUpdate;
  }

  function updateFormattingRegistration() {
    if (disposed) {
      return;
    }
    const newRegistrationKey = JSON.stringify(userDataFilePaths);
    if (newRegistrationKey === registrationKey) {
      return;
    }
    registrationKey = newRegistrationKey;
    initializationDisposables.dispose();

    const documentSelector: vscode.DocumentFilter[] = [
      // Match all files so dprint remains available in "Format Document With..." even when another extension is the default formatter.
      // The service checks the file's configuration and asks dprint whether it can format it.
      { scheme: "file" },
      // User data files (ex. the user settings.json) aren't file scheme documents.
      // They're only registered when a plugin in the file's config can format them.
      ...userDataFilePaths.map(pattern => ({ scheme: USER_DATA_SCHEME, pattern })),
    ];
    initializationDisposables.push(vscode.languages.registerDocumentFormattingEditProvider(
      documentSelector,
      {
        provideDocumentFormattingEdits(document, options, token) {
          return workspaceService.provideDocumentFormattingEdits(document, options, token);
        },
      },
    ));
    initializationDisposables.push(vscode.languages.registerDocumentRangeFormattingEditProvider(
      documentSelector,
      {
        provideDocumentRangeFormattingEdits(document, range, options, token) {
          return workspaceService.provideDocumentRangeFormattingEdits(document, range, options, token);
        },
      },
    ));
  }

  // This is separate from the formatting registration update so that the workspace
  // registration doesn't wait on starting dprint for a config outside the workspace.
  function scheduleUserDataFilePathsUpdate() {
    userDataFilePathsUpdate = userDataFilePathsUpdate
      .then(async () => {
        const newUserDataFilePaths = await getFormattableUserDataFilePaths();
        if (!disposed && JSON.stringify(newUserDataFilePaths) !== JSON.stringify(userDataFilePaths)) {
          userDataFilePaths = newUserDataFilePaths;
          await scheduleFormattingRegistrationUpdate();
        }
      })
      .catch(err => logger.logError("Error updating the user data files to format:", err));
    return userDataFilePathsUpdate;
  }

  /** Gets the paths of the visible user data files that a plugin can format. */
  async function getFormattableUserDataFilePaths() {
    // the user data files are on the local machine, so they can't be formatted from a remote extension host
    if (vscode.env.remoteName != null) {
      return [];
    }
    const uris = vscode.window.visibleTextEditors.map(editor => editor.document.uri).filter(isUserDataUri);
    const canFormat = await Promise.all(uris.map(uri => workspaceService.canFormatWithPlugin(uri)));
    return [...new Set(uris.filter((_, i) => canFormat[i]).map(uri => uri.fsPath))].sort();
  }

}

function isUserDataUri(uri: vscode.Uri) {
  return uri.scheme === USER_DATA_SCHEME;
}
