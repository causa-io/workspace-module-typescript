import { WorkspaceContext } from '@causa/workspace';
import {
  DockerService,
  ProjectBuildArtefact,
  ServiceContainerConfiguration,
} from '@causa/workspace-core';
import { resolve } from 'path';
import { fileURLToPath } from 'url';
import * as uuid from 'uuid';
import { TypeScriptConfiguration } from '../index.js';

const DOCKER_FILE = fileURLToPath(
  new URL('../assets/Dockerfile-typescript-service-container', import.meta.url),
);

/**
 * Implements the {@link ProjectBuildArtefact} function for a TypeScript service container.
 * This uses the Docker CLI to build the image and return its tag, which can be specified in
 * {@link ProjectBuildArtefact.artefact}. Otherwise, a UUID will be generated as the tag.
 * The default Dockerfile can be overridden using the `typescript.serviceContainerDockerfile` configuration.
 * `NODE_VERSION` and `NPM_VERSION` are automatically passed as build arguments, obtained from the
 * `javascript.node.version` and `javascript.npm.version` configurations.
 */
export class ProjectBuildArtefactForServiceContainer extends ProjectBuildArtefact {
  async _call(context: WorkspaceContext): Promise<string> {
    const path = context.getProjectPathOrThrow();
    const dockerService = context.service(DockerService);
    const serviceContainerConf =
      context.asConfiguration<ServiceContainerConfiguration>();
    const typeScriptConf = context.asConfiguration<TypeScriptConfiguration>();

    const projectName = serviceContainerConf.get('project.name');
    context.logger.info(
      `🍱 Building Docker image for TypeScript project '${projectName}'.`,
    );

    const confFile = typeScriptConf.get(
      'typescript.serviceContainerDockerfile',
    );
    const file = confFile ? resolve(context.rootPath, confFile) : DOCKER_FILE;
    const platform = serviceContainerConf.get('serviceContainer.architecture');
    const imageName = this.artefact ?? uuid.v4();
    const buildArgs: Record<string, string> = {
      NODE_VERSION: typeScriptConf.get('javascript.node.version') ?? 'latest',
      NPM_VERSION: typeScriptConf.get('javascript.npm.version') ?? 'latest',
      ...(await serviceContainerConf.getAndRender(
        'serviceContainer.buildArgs',
      )),
    };

    await dockerService.build(path, {
      file,
      platform,
      buildArgs,
      tags: [imageName],
    });

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
