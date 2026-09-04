import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { DPRINT_CONFIG_FILE_NAMES } from "./constants";

export function ancestorDirsContainConfigFilePath(
  dirPath: string,
  fileExists: (path: string) => boolean = existsSync,
): boolean {
  for (const ancestorDirectoryPath of enumerateAncestorDirectories(dirPath)) {
    for (const configFileName of DPRINT_CONFIG_FILE_NAMES) {
      try {
        if (fileExists(join(ancestorDirectoryPath, configFileName))) {
          return true;
        }
      } catch {
        // Continue searching when a file system lookup fails.
      }
    }
  }
  return false;
}

export function* enumerateAncestorDirectories(path: string): Iterable<string> {
  let currentPath = path;
  while (true) {
    const ancestorDirectoryPath = dirname(currentPath);
    if (ancestorDirectoryPath === currentPath) {
      return;
    }
    yield ancestorDirectoryPath;
    currentPath = ancestorDirectoryPath;
  }
}
