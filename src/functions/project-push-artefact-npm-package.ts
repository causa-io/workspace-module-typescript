import { WorkspaceContext } from '@causa/workspace';
import { ProjectPushArtefact } from '@causa/workspace-core';
import { InvalidFunctionArgumentError } from '@causa/workspace/function-registry';
import { NpmService } from '../services/index.js';
import {
  makeNpmPackageArtefactDestination,
  readNpmPackageFile,
} from '../utils.js';

/**
 * Implements the {@link ProjectPushArtefact} function for an npm package by calling `npm publish`.
 * The only supported destination is when the tag is the current semantic version defined in the `package.json` file.
 * This is a limitation of `npm publish`.
 */
export class ProjectPushArtefactForNpmPackage extends ProjectPushArtefact {
  async _call(context: WorkspaceContext): Promise<string> {
    const projectPath = context.getProjectPathOrThrow();
    const npmService = context.service(NpmService);

    if (this.artefact !== projectPath) {
      throw new InvalidFunctionArgumentError(
        'The artefact for a JavaScript project to push must be the path to the project root.',
      );
    }

    if (this.overwrite) {
      throw new InvalidFunctionArgumentError(
        `The 'overwrite' argument is not supported when publishing npm packages. A version cannot be reused.`,
      );
    }

    const packageInfo = await readNpmPackageFile(projectPath);
    const destination = makeNpmPackageArtefactDestination(packageInfo);
    if (this.destination !== destination) {
      throw new InvalidFunctionArgumentError(
        `Destination '${this.destination}' is not supported. The only allowed destination is the one matching the npm package definition, i.e. '${destination}'.`,
      );
    }

    const projectName = context.get('project.name');
    context.logger.info(
      `🚚 Publishing npm package for project '${projectName}'.`,
    );

    await npmService.publish({
      workingDirectory: projectPath,
    });

    context.logger.info(`🚚 Successfully published npm package.`);

    return projectPath;
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      ['javascript', 'typescript'].includes(
        context.get('project.language') ?? '',
      ) && context.get('project.type') === 'package'
    );
  }
}
