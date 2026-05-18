import { ProjectGetArtefactDestination } from '@causa/workspace-core';
import {
  makeNpmPackageArtefactDestination,
  readNpmPackageFile,
} from '../../utils.js';

/**
 * Implements the {@link ProjectGetArtefactDestination} function for an npm package.
 * This returns a normalized destination based on the package name and the provided tag: `<package-name>@<tag>`.
 */
export class ProjectGetArtefactDestinationForNpmPackage extends ProjectGetArtefactDestination {
  async _call(): Promise<string> {
    const projectPath = this._context.getProjectPathOrThrow();
    const packageInfo = await readNpmPackageFile(projectPath);
    return makeNpmPackageArtefactDestination(packageInfo, this.tag);
  }

  _supports(): boolean {
    return (
      ['javascript', 'typescript'].includes(
        this._context.get('project.language') ?? '',
      ) && this._context.get('project.type') === 'package'
    );
  }
}
