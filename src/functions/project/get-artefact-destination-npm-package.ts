import { WorkspaceContext } from '@causa/workspace';
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
  async _call(context: WorkspaceContext): Promise<string> {
    const projectPath = context.getProjectPathOrThrow();
    const packageInfo = await readNpmPackageFile(projectPath);
    return makeNpmPackageArtefactDestination(packageInfo, this.tag);
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      ['javascript', 'typescript'].includes(
        context.get('project.language') ?? '',
      ) && context.get('project.type') === 'package'
    );
  }
}
