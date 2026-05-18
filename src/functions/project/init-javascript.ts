import { ProjectInit } from '@causa/workspace-core';
import { NpmService } from '../../services/index.js';

/**
 * Implements the {@link ProjectInit} function for JavaScript and TypeScript projects, by running `npm ci`.
 */
export class ProjectInitForJavaScript extends ProjectInit {
  async _call(): Promise<void> {
    const projectPath = this._context.getProjectPathOrThrow();
    const projectName = this._context.get('project.name');

    this._context.logger.info(
      `🎉 Installing npm packages for project '${projectName}'.`,
    );

    if (this.force) {
      this._context.logger.warn(
        '⚠️ Force option is not needed as a clean install is always performed.',
      );
    }

    await this._context.service(NpmService).ci({
      workingDirectory: projectPath,
      logging: { stdout: null, stderr: 'info' },
    });

    this._context.logger.info('✅ Successfully installed npm packages.');
  }

  _supports(): boolean {
    return (
      !this.workspace &&
      ['javascript', 'typescript'].includes(
        this._context.get('project.language') ?? '',
      )
    );
  }
}
