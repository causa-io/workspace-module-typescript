import { WorkspaceContext } from '@causa/workspace';
import { ProjectPushArtefact } from '@causa/workspace-core';
import {
  InvalidFunctionArgumentError,
  NoImplementationFoundError,
} from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import 'jest-extended';
import { join } from 'path';
import { NpmService } from '../services/index.js';
import { ProjectPushArtefactForNpmPackage } from './project-push-artefact-npm-package.js';

describe('ProjectPushArtefactForNpmPackage', () => {
  let tmpDir: string;
  let context: WorkspaceContext;
  let npmService: NpmService;

  beforeEach(async () => {
    tmpDir = await mkdtemp('causa-test-');
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
      functions: [ProjectPushArtefactForNpmPackage],
    }));
    npmService = context.service(NpmService);
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ name: 'my-project', version: '1.0.0' }),
    );
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should not support projects that are not written in TypeScript or JavaScript', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: { name: 'my-project', type: 'package', language: 'ruby' },
      },
      functions: [ProjectPushArtefactForNpmPackage],
    }));

    expect(() =>
      context.call(ProjectPushArtefact, { artefact: '🍱', destination: '📦' }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should not support projects that are not packages', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: 'typescript',
        },
      },
      functions: [ProjectPushArtefactForNpmPackage],
    }));

    expect(() =>
      context.call(ProjectPushArtefact, { artefact: '🍱', destination: '📦' }),
    ).toThrow(NoImplementationFoundError);
  });

  it('should not allow the artefact option', async () => {
    const actualPromise = context.call(ProjectPushArtefact, {
      artefact: 'package.zip',
      destination: '📦',
    });

    await expect(actualPromise).rejects.toThrow(InvalidFunctionArgumentError);
  });

  it('should not allow the overwrite option', async () => {
    const actualPromise = context.call(ProjectPushArtefact, {
      artefact: tmpDir,
      destination: 'my-project@1.0.0',
      overwrite: true,
    });

    await expect(actualPromise).rejects.toThrow(InvalidFunctionArgumentError);
  });

  it('should throw for an invalid destination', async () => {
    const actualPromise = context.call(ProjectPushArtefact, {
      artefact: tmpDir,
      destination: 'my-project@abcd123',
    });

    await expect(actualPromise).rejects.toThrow(InvalidFunctionArgumentError);
  });

  it('should publish the package to the npm registry', async () => {
    const expectedDestination = 'my-project@1.0.0';
    jest.spyOn(npmService, 'publish').mockResolvedValueOnce();

    const actualDestination = await context.call(ProjectPushArtefact, {
      artefact: tmpDir,
      destination: expectedDestination,
    });

    expect(actualDestination).toEqual(tmpDir);
    expect(npmService.publish).toHaveBeenCalledWith({
      workingDirectory: tmpDir,
    });
  });
});
