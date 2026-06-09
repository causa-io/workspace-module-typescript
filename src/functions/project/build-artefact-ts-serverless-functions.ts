import {
  ProjectBuildArtefact,
  type ServerlessFunctionsConfiguration,
} from '@causa/workspace-core';
import { ZipArchive } from 'archiver';
import { createWriteStream } from 'fs';
import { mkdir } from 'fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { dirname, resolve } from 'path';
import { NpmService } from '../../services/index.js';

/**
 * The default glob patterns that are used to create the serverless functions archive.
 */
const DEFAULT_ARCHIVE_GLOB_PATTERNS = [
  'package.json',
  'package-lock.json',
  'dist/**/*',
  '.npmrc',
];

/**
 * Implements the {@link ProjectBuildArtefact} function for TypeScript serverless functions.
 * This first builds the project using the `npm run build` script and then creates a ZIP archive containing the
 * `package.json`, `package-lock.json`, `.npmrc`, and the `dist` folder.
 * The returned artefact is the path to the created ZIP archive.
 */
export class ProjectBuildArtefactForTypeScriptServerlessFunctions extends ProjectBuildArtefact {
  async _call(): Promise<string> {
    const projectPath = this._context.getProjectPathOrThrow();
    const npmService = this._context.service(NpmService);

    const projectName = this._context.get('project.name');
    this._context.logger.info(
      `🍱 Compiling TypeScript project '${projectName}'.`,
    );

    await npmService.build({ workingDirectory: projectPath });

    this._context.logger.info(`🍱 Successfully compiled TypeScript project.`);

    this._context.logger.info(
      `🍱 Creating ZIP archive for serverless functions.`,
    );

    const archivePath = this.artefact
      ? resolve(this.artefact)
      : join(projectPath, `${randomUUID()}.zip`);
    const globPatterns = [
      ...DEFAULT_ARCHIVE_GLOB_PATTERNS,
      ...(this._context
        .asConfiguration<ServerlessFunctionsConfiguration>()
        .get('serverlessFunctions.build.globPatterns') ?? []),
    ];

    await this.createArchive(archivePath, projectPath, globPatterns);

    this._context.logger.info(`🍱 Successfully created the archive.`);

    return archivePath;
  }

  _supports(): boolean {
    return (
      this._context.get('project.language') === 'typescript' &&
      this._context.get('project.type') === 'serverlessFunctions'
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
    await mkdir(dirname(archivePath), { recursive: true });
    const archive = new ZipArchive({ zlib: { level: 9 } });
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
