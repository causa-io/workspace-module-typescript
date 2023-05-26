import { WorkspaceContext } from '@causa/workspace';
import { ProjectBuildArtefact } from '@causa/workspace-core';
import { InvalidFunctionArgumentError } from '@causa/workspace/function-registry';
import { NpmService } from '../services/index.js';

/**
 * Implements the {@link ProjectBuildArtefact} function for a TypeScript package by running `npm run build`.
 * This implementation does not support the optional {@link ProjectBuildArtefact.artefact} argument.
 * The returned output artefact is always the project directory.
 */
export class ProjectBuildArtefactForTypeScriptPackage extends ProjectBuildArtefact {
  async _call(context: WorkspaceContext): Promise<string> {
    const projectPath = context.getProjectPathOrThrow();
    const npmService = context.service(NpmService);

    if (this.artefact && this.artefact !== projectPath) {
      throw new InvalidFunctionArgumentError(
        'The artefact option is not supported. The TypeScript configuration determines the output folder.',
      );
    }

    const projectName = context.get('project.name');
    context.logger.info(`🍱 Compiling TypeScript project '${projectName}'.`);

    await npmService.build({
      workingDirectory: projectPath,
    });

    context.logger.info(`🍱 Successfully compiled TypeScript project.`);

    return projectPath;
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      context.get('project.language') === 'typescript' &&
      context.get('project.type') === 'package'
    );
  }
}
