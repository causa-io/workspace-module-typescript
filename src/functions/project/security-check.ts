import { ProjectSecurityCheck } from '@causa/workspace-core';
import {
  DockerService,
  ProcessServiceExitCodeError,
} from '@causa/workspace-core/services';
import { NpmService } from '../../services/index.js';

/**
 * The Docker image to run to perform static security checks.
 */
const NJSSCAN_DOCKER_IMAGE = 'opensecurity/njsscan';

/**
 * The location in the Docker container where the project code is mounted.
 */
const CONTAINER_CODE_LOCATION = '/workdir';

/**
 * Implements the {@link ProjectSecurityCheck} function for JavaScript and TypeScript projects, by running `njsscan` in
 * a Docker container.
 * For TypeScript projects, the code is first compiled to JavaScript as checks only run on JavaScript code.
 */
export class ProjectSecurityCheckForJavaScript extends ProjectSecurityCheck {
  async _call(): Promise<void> {
    this._context.logger.warn(
      '⚠️ The security check for JavaScript and TypeScript projects in its current form is deprecated and will be removed in a future release.',
    );

    const projectPath = this._context.getProjectPathOrThrow();
    const projectName = this._context.get('project.name');

    if (this._context.get('project.language') === 'typescript') {
      this._context.logger.info(
        `🍱 Compiling TypeScript project '${projectName}'.`,
      );

      await this._context
        .service(NpmService)
        .build({ workingDirectory: projectPath });
    }

    this._context.logger.info(
      `🔒 Running static security checks on source code for project '${projectName}'.`,
    );

    try {
      await this._context.service(DockerService).run(NJSSCAN_DOCKER_IMAGE, {
        rm: true,
        mounts: [
          {
            type: 'bind',
            source: projectPath,
            destination: CONTAINER_CODE_LOCATION,
            readonly: true,
          },
        ],
        commandAndArgs: ['-w', CONTAINER_CODE_LOCATION],
        logging: 'info',
      });

      this._context.logger.info(`✅ Code passed security checks.`);
    } catch (error) {
      if (error instanceof ProcessServiceExitCodeError) {
        throw new Error('Code failed security checks.');
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
