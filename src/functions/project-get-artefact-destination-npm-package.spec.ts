import { WorkspaceContext } from '@causa/workspace';
import { ProjectGetArtefactDestination } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { ProjectGetArtefactDestinationForNpmPackage } from './project-get-artefact-destination-npm-package.js';

describe('ProjectGetArtefactDestinationForNpmPackage', () => {
  let tmpDir: string;
  let context: WorkspaceContext;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'causa-test-'));
    ({ context } = createContext({
      projectPath: tmpDir,
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'package',
          language: 'typescript',
        },
      },
      functions: [ProjectGetArtefactDestinationForNpmPackage],
    }));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should not handle projects with unsupported languages', async () => {
    ({ context } = createContext({
      projectPath: tmpDir,
      configuration: {
        workspace: { name: '🏷️' },
        project: { name: 'my-project', type: 'package', language: 'python' },
      },
      functions: [ProjectGetArtefactDestinationForNpmPackage],
    }));

    expect(() =>
      context.call(ProjectGetArtefactDestination, { tag: '🔖' }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should not handle projects with unsupported types', async () => {
    ({ context } = createContext({
      projectPath: tmpDir,
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: 'typescript',
        },
      },
      functions: [ProjectGetArtefactDestinationForNpmPackage],
    }));

    expect(() =>
      context.call(ProjectGetArtefactDestination, { tag: '🔖' }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should return the destination based on the package name and the provided tag', async () => {
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({
        name: 'test-package',
        version: '1.0.0',
      }),
    );

    const actualDestination = await context.call(
      ProjectGetArtefactDestination,
      { tag: '🔖' },
    );

    expect(actualDestination).toEqual('test-package@🔖');
  });
});
