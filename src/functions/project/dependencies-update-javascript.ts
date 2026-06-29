import { callDeferred } from '@causa/workspace';
import { ProjectDependenciesUpdate } from '@causa/workspace-core';

/**
 * Implements the {@link ProjectDependenciesUpdate} function for JavaScript and TypeScript projects.
 * This uses `npm-check-updates` to update the dependencies in the `package.json` file and then runs `npm update` to
 * download the new dependencies, update the indirect dependencies and update the `package-lock.json` file.
 */
export class ProjectDependenciesUpdateForJavaScript extends ProjectDependenciesUpdate {
  async _call(): Promise<boolean> {
    return await callDeferred(this, import.meta.url);
  }

  _supports(): boolean {
    return ['javascript', 'typescript'].includes(
      this._context.get('project.language') ?? '',
    );
  }
}
