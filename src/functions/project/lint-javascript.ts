import { ProjectLint } from '@causa/workspace-core';
import { NpmExitCodeError, NpmService } from '../../services/index.js';

/**
 * The npm script to run to lint the project.
 */
const NPM_LINT_SCRIPT = 'lint';

/**
 * Implements the {@link ProjectLint} function for JavaScript and TypeScript projects, by running `npm run lint`.
 */
export class ProjectLintForJavaScript extends ProjectLint {
  async _call(): Promise<void> {
    const projectPath = this._context.getProjectPathOrThrow();
    const projectName = this._context.get('project.name');

    this._context.logger.info(`🎨 Linting code for project '${projectName}'.`);

    try {
      await this._context.service(NpmService).run(NPM_LINT_SCRIPT, {
        workingDirectory: projectPath,
        logging: 'info',
      });

      this._context.logger.info('✅ Code passed linter checks.');
    } catch (error) {
      if (error instanceof NpmExitCodeError) {
        throw new Error('Code failed linter checks.');
      }

      throw error;
    }
  }

  _supports(): boolean {
    return ['javascript', 'typescript'].includes(
      this._context.get('project.language') ?? '',
    );
  }
}
