import { WorkspaceContext } from '@causa/workspace';
import { ProjectBuildArtefact } from '@causa/workspace-core';
import { ServiceContainerBuilderService } from '@causa/workspace-core/services';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { fileURLToPath } from 'url';
import { ProjectBuildArtefactForTypeScriptServiceContainer } from './build-artefact-ts-service-container.js';

describe('ProjectBuildArtefactForTypeScriptServiceContainer', () => {
  let context: WorkspaceContext;
  let builderService: ServiceContainerBuilderService;

  const expectedDockerFile = fileURLToPath(
    new URL(
      '../../assets/Dockerfile-typescript-service-container',
      import.meta.url,
    ),
  );

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: 'typescript',
        },
        serviceContainer: {
          architecture: '🖥️',
          buildArgs: {
            MY_ARG: 'my-value',
            MY_OTHER_ARG: {
              $format: "prefix-${ configuration('workspace.name') }",
            },
          },
        },
      },
      functions: [ProjectBuildArtefactForTypeScriptServiceContainer],
    }));
    builderService = context.service(ServiceContainerBuilderService);
  });

  it('should not support projects that are not written in TypeScript', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: 'ruby',
        },
      },
      functions: [ProjectBuildArtefactForTypeScriptServiceContainer],
    }));

    expect(() => context.call(ProjectBuildArtefact, {})).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should not support projects that are not service containers', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'package',
          language: 'typescript',
        },
      },
      functions: [ProjectBuildArtefactForTypeScriptServiceContainer],
    }));

    expect(() => context.call(ProjectBuildArtefact, {})).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should build the Docker image with the proper build arguments', async () => {
    jest.spyOn(builderService, 'build').mockResolvedValueOnce();

    const actualArtefact = await context.call(ProjectBuildArtefact, {});

    expect(actualArtefact).toBeString();
    expect(builderService.build).toHaveBeenCalledExactlyOnceWith(
      context.projectPath,
      actualArtefact,
      expectedDockerFile,
      {
        baseBuildArgs: {
          NODE_VERSION: 'latest',
          NODE_MAJOR_VERSION: '20',
          NPM_VERSION: 'latest',
        },
      },
    );
  });

  it('should use the passed artefact as the image name', async () => {
    const expectedArtefact = 'my-image-name';
    jest.spyOn(builderService, 'build').mockResolvedValueOnce();

    const actualArtefact = await context.call(ProjectBuildArtefact, {
      artefact: expectedArtefact,
    });

    expect(actualArtefact).toEqual(expectedArtefact);
    expect(builderService.build).toHaveBeenCalledExactlyOnceWith(
      context.projectPath,
      expectedArtefact,
      expectedDockerFile,
      {
        baseBuildArgs: {
          NODE_VERSION: 'latest',
          NODE_MAJOR_VERSION: '20',
          NPM_VERSION: 'latest',
        },
      },
    );
  });

  it('should use the specified Node and npm versions', async () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: 'typescript',
        },
        javascript: { node: { version: '18.1.0' }, npm: { version: '7.0.0' } },
      },
      functions: [ProjectBuildArtefactForTypeScriptServiceContainer],
    }));
    builderService = context.service(ServiceContainerBuilderService);
    jest.spyOn(builderService, 'build').mockResolvedValueOnce();

    const actualArtefact = await context.call(ProjectBuildArtefact, {});

    expect(actualArtefact).toBeString();
    expect(builderService.build).toHaveBeenCalledExactlyOnceWith(
      context.projectPath,
      actualArtefact,
      expectedDockerFile,
      {
        baseBuildArgs: {
          NODE_VERSION: '18.1.0',
          NODE_MAJOR_VERSION: '18',
          NPM_VERSION: '7.0.0',
        },
      },
    );
  });
});
