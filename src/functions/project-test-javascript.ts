import { WorkspaceContext } from '@causa/workspace';
import { ProjectTest } from '@causa/workspace-core';
import { NpmExitCodeError, NpmService } from '../services/index.js';

/**
 * The npm script to run to test the project.
 */
const NPM_TEST_SCRIPT = 'test';

/**
 * The npm script to run to test the project and compute the code coverage.
 */
const NPM_TEST_COVERAGE_SCRIPT = 'test:cov';

/**
 * Implements the {@link ProjectTest} function for JavaScript and TypeScript projects, by running `npm run test`.
 * If the `coverage` option is set, the `test:cov` script is run instead.
 */
export class ProjectTestForJavaScript extends ProjectTest {
  async _call(context: WorkspaceContext): Promise<void> {
    const projectPath = context.getProjectPathOrThrow();
    const projectName = context.get('project.name');

    context.logger.info(`🧪 Running tests for project '${projectName}'.`);

    const script = this.coverage ? NPM_TEST_COVERAGE_SCRIPT : NPM_TEST_SCRIPT;

    try {
      await context.service(NpmService).run(script, {
        workingDirectory: projectPath,
        logging: 'info',
      });

      context.logger.info('✅ Code passed tests.');
    } catch (error) {
      if (error instanceof NpmExitCodeError) {
        throw new Error('Code failed tests.');
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
