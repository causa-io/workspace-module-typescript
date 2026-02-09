import { WorkspaceContext } from '@causa/workspace';
import { ProjectBuildArtefact } from '@causa/workspace-core';
import { ServiceContainerBuilderService } from '@causa/workspace-core/services';
import { randomUUID } from 'node:crypto';
import { major } from 'semver';
import { fileURLToPath } from 'url';
import type { TypeScriptConfiguration } from '../../index.js';

/**
 * The default Dockerfile for TypeScript service containers.
 */
const DOCKER_FILE = fileURLToPath(
  new URL(
    '../../assets/Dockerfile-typescript-service-container',
    import.meta.url,
  ),
);

/**
 * The default Node.js major version when `javascript.node.version` is set to `latest`.
 */
const DEFAULT_NODE_MAJOR_VERSION = '20';

/**
 * Implements the {@link ProjectBuildArtefact} function for a TypeScript service container.
 * This uses the Docker CLI to build the image and return its tag, which can be specified in
 * {@link ProjectBuildArtefact.artefact}. Otherwise, a UUID will be generated as the tag.
 * The default Dockerfile can be overridden using the `serviceContainer.buildFile` configuration.
 * `NODE_VERSION`, `NODE_MAJOR_VERSION` and `NPM_VERSION` are automatically passed as build arguments, obtained from the
 * `javascript.node.version` and `javascript.npm.version` configurations.
 */
export class ProjectBuildArtefactForTypeScriptServiceContainer extends ProjectBuildArtefact {
  async _call(context: WorkspaceContext): Promise<string> {
    const path = context.getProjectPathOrThrow();
    const builderService = context.service(ServiceContainerBuilderService);
    const typeScriptConf = context.asConfiguration<TypeScriptConfiguration>();

    const projectName = context.get('project.name');
    context.logger.info(
      `🍱 Building Docker image for TypeScript project '${projectName}'.`,
    );

    const imageName = this.artefact ?? randomUUID();
    const nodeVersion =
      typeScriptConf.get('javascript.node.version') ?? 'latest';
    const nodeMajorVersion =
      nodeVersion === 'latest'
        ? DEFAULT_NODE_MAJOR_VERSION
        : major(nodeVersion).toString();
    const baseBuildArgs: Record<string, string> = {
      NODE_VERSION: nodeVersion,
      NODE_MAJOR_VERSION: nodeMajorVersion,
      NPM_VERSION: typeScriptConf.get('javascript.npm.version') ?? 'latest',
    };

    await builderService.build(path, imageName, DOCKER_FILE, { baseBuildArgs });

    context.logger.info(`🍱 Successfully built image with tag '${imageName}'.`);

    return imageName;
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      context.get('project.language') === 'typescript' &&
      context.get('project.type') === 'serviceContainer'
    );
  }
}
