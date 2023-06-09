import { WorkspaceContext } from '@causa/workspace';
import { ProjectLint } from '@causa/workspace-core';
import { NpmExitCodeError, NpmService } from '../services/index.js';

/**
 * The npm script to run to lint the project.
 */
const NPM_LINT_SCRIPT = 'lint';

/**
 * Implements the {@link ProjectLint} function for JavaScript and TypeScript projects, by running `npm run lint`.
 */
export class ProjectLintForJavaScript extends ProjectLint {
  async _call(context: WorkspaceContext): Promise<void> {
    const projectPath = context.getProjectPathOrThrow();
    const projectName = context.get('project.name');

    context.logger.info(`🎨 Linting code for project '${projectName}'.`);

    try {
      await context.service(NpmService).run(NPM_LINT_SCRIPT, {
        workingDirectory: projectPath,
        logging: 'info',
      });

      context.logger.info('✅ Code passed linter checks.');
    } catch (error) {
      if (error instanceof NpmExitCodeError) {
        throw new Error('Code failed linter checks.');
      }

      throw error;
    }
  }

  _supports(context: WorkspaceContext): boolean {
    return ['javascript', 'typescript'].includes(
      context.get('project.language') ?? '',
    );
  }
}
