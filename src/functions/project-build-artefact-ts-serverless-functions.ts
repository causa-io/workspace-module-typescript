import { WorkspaceContext } from '@causa/workspace';
import {
  ProjectBuildArtefact,
  type ServerlessFunctionsConfiguration,
} from '@causa/workspace-core';
import archiver from 'archiver';
import { createWriteStream } from 'fs';
import { randomUUID } from 'node:crypto';
import { resolve } from 'path';
import { NpmService } from '../services/index.js';

/**
 * The default glob patterns that are used to create the serverless functions archive.
 */
const DEFAULT_ARCHIVE_GLOB_PATTERNS = [
  'package.json',
  'package-lock.json',
  'dist/**/*',
];

/**
 * Implements the {@link ProjectBuildArtefact} function for TypeScript serverless functions.
 * This first builds the project using the `npm run build` script and then creates a ZIP archive containing the
 * `package.json`, `package-lock.json` and the `dist` folder.
 * The returned artefact is the path to the created ZIP archive.
 */
export class ProjectBuildArtefactForTypeScriptServerlessFunctions extends ProjectBuildArtefact {
  async _call(context: WorkspaceContext): Promise<string> {
    const projectPath = context.getProjectPathOrThrow();
    const npmService = context.service(NpmService);

    const projectName = context.get('project.name');
    context.logger.info(`🍱 Compiling TypeScript project '${projectName}'.`);

    await npmService.build({ workingDirectory: projectPath });

    context.logger.info(`🍱 Successfully compiled TypeScript project.`);

    context.logger.info(`🍱 Creating ZIP archive for serverless functions.`);

    const archivePath = resolve(
      process.cwd(),
      this.artefact ?? `${randomUUID()}.zip`,
    );
    const globPatterns = [
      ...DEFAULT_ARCHIVE_GLOB_PATTERNS,
      ...(context
        .asConfiguration<ServerlessFunctionsConfiguration>()
        .get('serverlessFunctions.build.globPatterns') ?? []),
    ];

    await this.createArchive(archivePath, projectPath, globPatterns);

    context.logger.info(`🍱 Successfully created the archive.`);

    return archivePath;
  }

  _supports(context: WorkspaceContext): boolean {
    return (
      context.get('project.language') === 'typescript' &&
      context.get('project.type') === 'serverlessFunctions'
    );
  }

  /**
   * Creates the serverless functions archive for an already compiled TypeScript project.
   *
   * @param archivePath The path to the archive that should be created.
   * @param rootPath The root path of the project, used to resolve the glob patterns.
   * @param globPatterns The glob patterns that should be included in the archive.
   */
  private async createArchive(
    archivePath: string,
    rootPath: string,
    globPatterns: string[],
  ): Promise<void> {
    const archive = archiver('zip', { zlib: { level: 9 } });
    const output = createWriteStream(archivePath);

    return new Promise((resolve, reject) => {
      output.on('close', () => resolve());
      archive.on('error', (err) => reject(err));
      archive.pipe(output);

      globPatterns.forEach((pattern) =>
        archive.glob(pattern, { cwd: rootPath, follow: true }),
      );
      archive.finalize();
    });
  }
}
