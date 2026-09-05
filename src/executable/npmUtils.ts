import * as path from "node:path";
import type { LinuxFamily } from "../environment";

export function getDprintPackageName(platform: NodeJS.Platform, arch: string, linuxFamily: LinuxFamily = "glibc") {
  return platform === "linux" ? `${platform}-${arch}-${linuxFamily}` : `${platform}-${arch}`;
}

export function getDprintExeName(platform: NodeJS.Platform) {
  return platform === "win32" ? "dprint.exe" : "dprint";
}

export function getDprintExecutableRelativePath(packageName: string, platform: NodeJS.Platform) {
  return path.join("node_modules", "@dprint", packageName, getDprintExeName(platform));
}

export function shouldResolveNpmExecutable(resolveNpmExecutable: boolean | undefined) {
  return resolveNpmExecutable ?? true;
}
