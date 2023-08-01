import { readFile } from 'fs/promises';
import { join } from 'path';

/**
 * The name of the npm package file.
 */
export const PACKAGE_FILE = 'package.json';

/**
 * The name of the npm package lock file.
 */
export const PACKAGE_LOCK_FILE = 'package-lock.json';

/**
 * The schema for information expected to be contained in an npm package package file.
 */
export type NpmPackageInfo = {
  /**
   * The name of the package.
   */
  name: string;

  /**
   * The version of the package.
   */
  version: string;
};

/**
 * Returns the content of a package file for the package at the given path.
 *
 * @param path The path to the root directory for the project / package.
 * @returns The information read from the package file.
 */
export async function readNpmPackageFile(
  path: string,
): Promise<NpmPackageInfo> {
  const packageFile = join(path, PACKAGE_FILE);
  const packageBuffer = await readFile(packageFile);
  const packageInfo = JSON.parse(packageBuffer.toString());

  return packageInfo;
}

/**
 * Constructs the normalized artefact destination for an npm package.
 * It consists of the package name and version.
 * This destination is not actually used to publish a package, as `npm publish` will take care of that.
 *
 * @param info The information about the package.
 * @param version The version of the package. If not provided, it defaults to the version in the package information.
 * @returns The artefact destination for an npm package.
 */
export function makeNpmPackageArtefactDestination(
  info: NpmPackageInfo,
  version?: string,
): string {
  return `${info.name}@${version ?? info.version}`;
}
