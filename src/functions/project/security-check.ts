import { WorkspaceContext } from '@causa/workspace';
import {
  DockerService,
  ProcessServiceExitCodeError,
  ProjectSecurityCheck,
} from '@causa/workspace-core';
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
  async _call(context: WorkspaceContext): Promise<void> {
    const projectPath = context.getProjectPathOrThrow();
    const projectName = context.get('project.name');

    if (context.get('project.language') === 'typescript') {
      context.logger.info(`🍱 Compiling TypeScript project '${projectName}'.`);

      await context
        .service(NpmService)
        .build({ workingDirectory: projectPath });
    }

    context.logger.info(
      `🔒 Running static security checks on source code for project '${projectName}'.`,
    );

    try {
      await context.service(DockerService).run(NJSSCAN_DOCKER_IMAGE, {
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

      context.logger.info(`✅ Code passed security checks.`);
    } catch (error) {
      if (error instanceof ProcessServiceExitCodeError) {
        throw new Error('Code failed security checks.');
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
