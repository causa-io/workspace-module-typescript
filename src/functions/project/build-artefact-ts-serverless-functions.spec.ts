import { WorkspaceContext } from '@causa/workspace';
import { ProjectBuildArtefact } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import 'jest-extended';
import StreamZip from 'node-stream-zip';
import { join, resolve } from 'path';
import { NpmService } from '../../services/index.js';
import { ProjectBuildArtefactForTypeScriptServerlessFunctions } from './build-artefact-ts-serverless-functions.js';

describe('ProjectBuildArtefactForTypeScriptServerlessFunctions', () => {
  let tmpDir: string;
  let context: WorkspaceContext;
  let npmService: NpmService;
  let artefactPath: string | undefined;

  beforeEach(async () => {
    tmpDir = resolve(await mkdtemp('causa-test-'));
    ({ context } = createContext({
      projectPath: tmpDir,
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'serverlessFunctions',
          language: 'typescript',
        },
      },
      functions: [ProjectBuildArtefactForTypeScriptServerlessFunctions],
    }));
    npmService = context.service(NpmService);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
    if (artefactPath) {
      await rm(artefactPath, { force: true });
      artefactPath = undefined;
    }
  });

  it('should not support projects that are not written in TypeScript', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'serverlessFunctions',
          language: 'ruby',
        },
      },
      functions: [ProjectBuildArtefactForTypeScriptServerlessFunctions],
    }));

    expect(() => context.call(ProjectBuildArtefact, {})).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should not support projects that are not serverless functions', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'package',
          language: 'typescript',
        },
      },
      functions: [ProjectBuildArtefactForTypeScriptServerlessFunctions],
    }));

    expect(() => context.call(ProjectBuildArtefact, {})).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should run the build script and create a zip archive', async () => {
    jest.spyOn(npmService, 'build').mockResolvedValueOnce();
    await mkdir(resolve(tmpDir, 'dist'));
    await writeFile(resolve(tmpDir, 'package.json'), '{}');
    await writeFile(resolve(tmpDir, 'package-lock.json'), '🔒');
    await writeFile(resolve(tmpDir, 'dist', 'index.js'), '🧑‍💻');
    await writeFile(resolve(tmpDir, '.npmrc'), '🔧');
    await writeFile(resolve(tmpDir, 'nope.js'), '🙈');

    const actualArtefact = await context.call(ProjectBuildArtefact, {});

    expect(npmService.build).toHaveBeenCalledExactlyOnceWith({
      workingDirectory: tmpDir,
    });
    expect(await readArchiveContent(actualArtefact)).toEqual({
      'package.json': '{}',
      'package-lock.json': '🔒',
      'dist/index.js': '🧑‍💻',
      '.npmrc': '🔧',
    });
    artefactPath = actualArtefact;
  });

  it('should support the artefact option and custom glob patterns', async () => {
    ({ context } = createContext({
      projectPath: tmpDir,
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'serverlessFunctions',
          language: 'typescript',
        },
        serverlessFunctions: { build: { globPatterns: ['yes.js'] } },
      },
      functions: [ProjectBuildArtefactForTypeScriptServerlessFunctions],
    }));
    npmService = context.service(NpmService);
    jest.spyOn(npmService, 'build').mockResolvedValueOnce();
    await mkdir(resolve(tmpDir, 'dist'));
    await writeFile(resolve(tmpDir, 'package.json'), '{}');
    await writeFile(resolve(tmpDir, 'package-lock.json'), '🔒');
    await writeFile(resolve(tmpDir, 'dist', 'index.js'), '🧑‍💻');
    await writeFile(resolve(tmpDir, 'nope.js'), '🙈');
    await writeFile(resolve(tmpDir, 'yes.js'), '✅');
    const expectedArtefact = join(tmpDir, 'my-archive.zip');

    const actualArtefact = await context.call(ProjectBuildArtefact, {
      artefact: expectedArtefact,
    });

    expect(actualArtefact).toEqual(expectedArtefact);
    expect(npmService.build).toHaveBeenCalledExactlyOnceWith({
      workingDirectory: tmpDir,
    });
    expect(await readArchiveContent(actualArtefact)).toEqual({
      'package.json': '{}',
      'package-lock.json': '🔒',
      'dist/index.js': '🧑‍💻',
      'yes.js': '✅',
    });
    artefactPath = actualArtefact;
  });

  it('should create the archive directory if it does not exist', async () => {
    jest.spyOn(npmService, 'build').mockResolvedValueOnce();
    await mkdir(resolve(tmpDir, 'dist'));
    await writeFile(resolve(tmpDir, 'package.json'), '{}');
    await writeFile(resolve(tmpDir, 'dist', 'index.js'), '🧑‍💻');
    const expectedArtefact = join(tmpDir, 'sub', 'dir', 'my-archive.zip');

    const actualArtefact = await context.call(ProjectBuildArtefact, {
      artefact: expectedArtefact,
    });

    expect(actualArtefact).toEqual(expectedArtefact);
    expect(await readArchiveContent(actualArtefact)).toMatchObject({
      'package.json': '{}',
      'dist/index.js': '🧑‍💻',
    });
    artefactPath = actualArtefact;
  });

  async function readArchiveContent(
    archivePath: string,
  ): Promise<Record<string, string>> {
    const content: Record<string, string> = {};

    const zip = new StreamZip.async({ file: archivePath });
    const entries = Object.entries(await zip.entries());

    await Promise.all(
      entries.map(async ([path, entry]) => {
        if (entry.isDirectory) {
          return;
        }

        content[path] = (await zip.entryData(entry)).toString();
      }),
    );

    return content;
  }
});
