import { ProjectBuildArtefact } from '@causa/workspace-core';
import { InvalidFunctionArgumentError } from '@causa/workspace/function-registry';
import { mkdir } from 'fs/promises';
import { join, resolve } from 'path';
import type { TypeScriptConfiguration } from '../../configurations/index.js';
import { NpmService } from '../../services/index.js';

/**
 * Implements the {@link ProjectBuildArtefact} function for JavaScript and TypeScript packages.
 * For TypeScript packages, it runs `npm run build` followed by `npm pack`.
 * For JavaScript packages, it only runs `npm pack`.
 * This implementation does not support the optional {@link ProjectBuildArtefact.artefact} argument.
 * The returned output artefact is the path to the packed archive file.
 */
export class ProjectBuildArtefactForJavaScriptPackage extends ProjectBuildArtefact {
  async _call(): Promise<string> {
    const projectPath = this._context.getProjectPathOrThrow();
    const projectName = this._context.get('project.name');
    const projectLanguage = this._context.get('project.language');
    const packDestination = resolve(
      projectPath,
      this._context
        .asConfiguration<TypeScriptConfiguration>()
        .get('javascript.npm.packDestination') ?? '',
    );
    const npmService = this._context.service(NpmService);

    if (this.artefact) {
      throw new InvalidFunctionArgumentError(
        'The artefact option is not supported. The TypeScript configuration determines the output folder.',
      );
    }

    if (projectLanguage === 'typescript') {
      this._context.logger.info(
        `🍱 Compiling TypeScript project '${projectName}'.`,
      );
      await npmService.build({ workingDirectory: projectPath });
      this._context.logger.info(`🍱 Successfully compiled TypeScript project.`);
    }

    await mkdir(packDestination, { recursive: true });

    this._context.logger.info(`📦 Packing project '${projectName}'.`);
    const archiveName = await npmService.pack({
      workingDirectory: projectPath,
      packDestination,
    });
    this._context.logger.info(`📦 Successfully packed project.`);

    return join(packDestination, archiveName);
  }

  _supports(): boolean {
    return (
      ['javascript', 'typescript'].includes(
        this._context.get('project.language') ?? '',
      ) && this._context.get('project.type') === 'package'
    );
  }
}
