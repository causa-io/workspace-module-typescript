import { WorkspaceContext } from '@causa/workspace';
import { ProjectInit } from '@causa/workspace-core';
import { NpmService } from '../services/index.js';

/**
 * Implements the {@link ProjectInit} function for JavaScript and TypeScript projects, by running `npm ci`.
 */
export class ProjectInitForJavaScript extends ProjectInit {
  async _call(context: WorkspaceContext): Promise<void> {
    const projectPath = context.getProjectPathOrThrow();
    const projectName = context.get('project.name');

    context.logger.info(
      `🎉 Installing npm packages for project '${projectName}'.`,
    );

    if (this.force) {
      context.logger.warn(
        '⚠️ Force option is not needed as a clean install is always performed.',
      );
    }

    await context.service(NpmService).ci({
      workingDirectory: projectPath,
      logging: { stdout: null, stderr: 'info' },
    });

    context.logger.info('✅ Successfully installed npm packages.');
  }

  _supports(context: WorkspaceContext): boolean {
    return ['javascript', 'typescript'].includes(
      context.get('project.language') ?? '',
    );
  }
}
