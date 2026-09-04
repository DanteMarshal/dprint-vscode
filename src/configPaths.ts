import { existsSync } from "node:fs";
import * as path from "node:path";
import { DPRINT_CONFIG_FILE_NAMES } from "./constants";

type PathApi = Pick<typeof path, "dirname" | "isAbsolute" | "join" | "parse" | "relative" | "sep">;

export function ancestorDirsContainConfigFilePath(
  dirPath: string,
  fileExists: (path: string) => boolean = existsSync,
): boolean {
  for (const ancestorDirectoryPath of enumerateAncestorDirectories(dirPath)) {
    for (const configFileName of DPRINT_CONFIG_FILE_NAMES) {
      try {
        if (fileExists(path.join(ancestorDirectoryPath, configFileName))) {
          return true;
        }
      } catch {
        // Continue searching when a file system lookup fails.
      }
    }
  }
  return false;
}

export function* enumerateAncestorDirectories(dirPath: string): Iterable<string> {
  let currentPath = dirPath;
  while (true) {
    const ancestorDirectoryPath = path.dirname(currentPath);
    if (ancestorDirectoryPath === currentPath) {
      return;
    }
    yield ancestorDirectoryPath;
    currentPath = ancestorDirectoryPath;
  }
}

export function findConfigFileInAncestorDirectoriesPath(
  dirPath: string,
  fileExists: (path: string) => boolean = existsSync,
  pathApi: PathApi = path,
): string | undefined {
  let currentPath = dirPath;
  while (true) {
    for (const configFileName of DPRINT_CONFIG_FILE_NAMES) {
      const candidate = pathApi.join(currentPath, configFileName);
      try {
        if (fileExists(candidate)) {
          return candidate;
        }
      } catch {
        // Continue searching when a file system lookup fails.
      }
    }

    const parentPath = pathApi.dirname(currentPath);
    if (parentPath === currentPath) {
      return undefined;
    }
    currentPath = parentPath;
  }
}

export function isPathWithin(parentPath: string, candidatePath: string, pathApi: PathApi = path) {
  const relativePath = pathApi.relative(parentPath, candidatePath);
  return relativePath === ""
    || (!relativePath.startsWith(`..${pathApi.sep}`) && relativePath !== ".." && !pathApi.isAbsolute(relativePath));
}

export function getFileSystemRootPath(filePath: string, pathApi: PathApi = path) {
  return pathApi.parse(filePath).root;
}
