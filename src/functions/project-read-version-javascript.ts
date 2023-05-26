import { WorkspaceContext } from '@causa/workspace';
import { ProjectReadVersion } from '@causa/workspace-core';
import { readNpmPackageFile } from '../utils.js';

/**
 * Implements the {@link ProjectReadVersion} function for JavaScript projects, parsing the version from the
 * `package.json` file.
 */
export class ProjectReadVersionForJavascript extends ProjectReadVersion {
  async _call(context: WorkspaceContext): Promise<string> {
    const projectPath = context.getProjectPathOrThrow();
    const packageInfo = await readNpmPackageFile(projectPath);
    return packageInfo.version;
  }

  _supports(context: WorkspaceContext): boolean {
    return ['javascript', 'typescript'].includes(
      context.get('project.language') ?? '',
    );
  }
}
