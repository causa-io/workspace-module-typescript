import { WorkspaceContext } from '@causa/workspace';
import { ProjectPushArtefact } from '@causa/workspace-core';
import {
  InvalidFunctionArgumentError,
  NoImplementationFoundError,
} from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import 'jest-extended';
import { join } from 'path';
import * as tar from 'tar';
import { NpmService } from '../../services/index.js';
import { ProjectPushArtefactForNpmPackage } from './push-artefact-npm-package.js';

describe('ProjectPushArtefactForNpmPackage', () => {
  let tmpDir: string;
  let context: WorkspaceContext;
  let npmService: NpmService;
  let artefact: string;

  const packageInfo = { name: 'my-project', version: '1.0.0' };

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

    artefact = join(tmpDir, 'my-project-1.0.0.tgz');
    const packageDir = join(tmpDir, 'package');
    await mkdir(packageDir, { recursive: true });
    await writeFile(
      join(packageDir, 'package.json'),
      JSON.stringify(packageInfo),
    );
    await writeFile(join(packageDir, 'index.js'), 'console.log("Hello");');
    await tar.c({ file: artefact, gzip: true, cwd: tmpDir }, ['package']);
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

  it('should not allow the overwrite option', async () => {
    const actualPromise = context.call(ProjectPushArtefact, {
      artefact,
      destination: 'my-project@1.0.0',
      overwrite: true,
    });

    await expect(actualPromise).rejects.toThrow(InvalidFunctionArgumentError);
  });

  it('should throw for an invalid destination', async () => {
    const actualPromise = context.call(ProjectPushArtefact, {
      artefact,
      destination: 'my-project@2.0.0',
    });

    await expect(actualPromise).rejects.toThrow(InvalidFunctionArgumentError);
  });

  it('should publish from an archive', async () => {
    const expectedDestination = 'my-project@1.0.0';
    jest.spyOn(npmService, 'publish').mockResolvedValueOnce();

    const actualDestination = await context.call(ProjectPushArtefact, {
      artefact,
      destination: expectedDestination,
    });

    expect(actualDestination).toEqual(expectedDestination);
    expect(npmService.publish).toHaveBeenCalledExactlyOnceWith({
      packageSpec: artefact,
      workingDirectory: tmpDir,
    });
  });

  it('should publish with a tag for a prerelease version', async () => {
    const prereleasePackageInfo = {
      name: 'my-project',
      version: '1.0.0-rc.1',
    };
    await writeFile(
      join(tmpDir, 'package', 'package.json'),
      JSON.stringify(prereleasePackageInfo),
    );
    const rcArtefact = join(tmpDir, 'my-project-rc.tgz');
    await tar.c({ file: rcArtefact, gzip: true, cwd: tmpDir }, ['package']);
    jest.spyOn(npmService, 'publish').mockResolvedValueOnce();

    const expectedDestination = 'my-project@1.0.0-rc.1';
    const actualDestination = await context.call(ProjectPushArtefact, {
      artefact: rcArtefact,
      destination: expectedDestination,
    });

    expect(actualDestination).toEqual(expectedDestination);
    expect(npmService.publish).toHaveBeenCalledExactlyOnceWith({
      packageSpec: rcArtefact,
      workingDirectory: tmpDir,
      tag: 'rc',
    });
  });
});
