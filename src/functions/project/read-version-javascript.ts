import { ProjectReadVersion } from '@causa/workspace-core';
import { readNpmPackageFile } from '../../utils.js';

/**
 * Implements the {@link ProjectReadVersion} function for JavaScript projects, parsing the version from the
 * `package.json` file.
 */
export class ProjectReadVersionForJavaScript extends ProjectReadVersion {
  async _call(): Promise<string> {
    const projectPath = this._context.getProjectPathOrThrow();
    const packageInfo = await readNpmPackageFile(projectPath);
    return packageInfo.version;
  }

  _supports(): boolean {
    return ['javascript', 'typescript'].includes(
      this._context.get('project.language') ?? '',
    );
  }
}
