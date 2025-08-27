import { WorkspaceContext } from '@causa/workspace';
import { ProjectBuildArtefact } from '@causa/workspace-core';
import {
  InvalidFunctionArgumentError,
  NoImplementationFoundError,
} from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { join } from 'path';
import { NpmService } from '../services/index.js';
import { ProjectBuildArtefactForTypeScriptPackage } from './project-build-artefact-ts-package.js';

describe('ProjectBuildArtefactForTypeScriptPackage', () => {
  let context: WorkspaceContext;
  let npmService: NpmService;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'package',
          language: 'typescript',
        },
      },
      functions: [ProjectBuildArtefactForTypeScriptPackage],
    }));
    npmService = context.service(NpmService);
  });

  it('should not support projects that are not written in TypeScript', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: { name: 'my-project', type: 'package', language: 'ruby' },
      },
      functions: [ProjectBuildArtefactForTypeScriptPackage],
    }));
    npmService = context.service(NpmService);

    expect(() => context.call(ProjectBuildArtefact, {})).toThrow(
      NoImplementationFoundError,
    );
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
      functions: [ProjectBuildArtefactForTypeScriptPackage],
    }));
    npmService = context.service(NpmService);

    expect(() => context.call(ProjectBuildArtefact, {})).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should not allow the artefact option', async () => {
    const actualPromise = context.call(ProjectBuildArtefact, {
      artefact: '📦',
    });

    await expect(actualPromise).rejects.toThrow(InvalidFunctionArgumentError);
  });

  it('should run the build script and pack', async () => {
    const expectedArchiveName = 'my-project-1.0.0.tgz';
    jest.spyOn(npmService, 'build').mockResolvedValueOnce();
    jest.spyOn(npmService, 'pack').mockResolvedValueOnce(expectedArchiveName);

    const actualArtefact = await context.call(ProjectBuildArtefact, {});

    expect(actualArtefact).toEqual(
      join(context.projectPath!, expectedArchiveName),
    );
    expect(npmService.build).toHaveBeenCalledExactlyOnceWith({
      workingDirectory: context.projectPath,
    });
    expect(npmService.pack).toHaveBeenCalledExactlyOnceWith({
      workingDirectory: context.projectPath,
      packDestination: context.projectPath,
    });
  });

  it('should run the build script and pack with a custom destination', async () => {
    const expectedArchiveName = 'my-project-1.0.0.tgz';
    const packDestination = 'dist';
    const expectedPackDestination = join(context.projectPath!, packDestination);
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'package',
          language: 'typescript',
        },
        javascript: { npm: { packDestination } },
      },
      functions: [ProjectBuildArtefactForTypeScriptPackage],
    }));
    npmService = context.service(NpmService);
    jest.spyOn(npmService, 'build').mockResolvedValueOnce();
    jest.spyOn(npmService, 'pack').mockResolvedValueOnce(expectedArchiveName);

    const actualArtefact = await context.call(ProjectBuildArtefact, {});

    expect(actualArtefact).toEqual(
      join(expectedPackDestination, expectedArchiveName),
    );
    expect(npmService.build).toHaveBeenCalledExactlyOnceWith({
      workingDirectory: context.projectPath,
    });
    expect(npmService.pack).toHaveBeenCalledExactlyOnceWith({
      workingDirectory: context.projectPath,
      packDestination: expectedPackDestination,
    });
  });
});
