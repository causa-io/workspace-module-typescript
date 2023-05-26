import { WorkspaceContext } from '@causa/workspace';
import { DockerService, ProjectBuildArtefact } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { ProjectBuildArtefactForServiceContainer } from './project-build-artefact-service-container.js';

describe('ProjectBuildArtefactForServiceContainer', () => {
  let context: WorkspaceContext;
  let dockerService: DockerService;

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
      functions: [ProjectBuildArtefactForServiceContainer],
    }));
    dockerService = context.service(DockerService);
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
      functions: [ProjectBuildArtefactForServiceContainer],
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
      functions: [ProjectBuildArtefactForServiceContainer],
    }));

    expect(() => context.call(ProjectBuildArtefact, {})).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should build the Docker image with the proper build arguments', async () => {
    const expectedDockerFile = fileURLToPath(
      new URL(
        '../assets/Dockerfile-typescript-service-container',
        import.meta.url,
      ),
    );
    jest.spyOn(dockerService, 'build').mockResolvedValueOnce({ code: 0 });

    const actualArtefact = await context.call(ProjectBuildArtefact, {});

    expect(actualArtefact).toBeString();
    expect(dockerService.build).toHaveBeenCalledWith(context.projectPath, {
      file: expectedDockerFile,
      platform: '🖥️',
      buildArgs: {
        NODE_VERSION: 'latest',
        NPM_VERSION: 'latest',
        MY_ARG: 'my-value',
        MY_OTHER_ARG: 'prefix-🏷️',
      },
      tags: [actualArtefact],
    });
  });

  it('should use the passed artefact as the image name', async () => {
    const expectedDockerFile = fileURLToPath(
      new URL(
        '../assets/Dockerfile-typescript-service-container',
        import.meta.url,
      ),
    );
    const expectedArtefact = 'my-image-name';
    jest.spyOn(dockerService, 'build').mockResolvedValueOnce({ code: 0 });

    const actualArtefact = await context.call(ProjectBuildArtefact, {
      artefact: expectedArtefact,
    });

    expect(actualArtefact).toEqual(expectedArtefact);
    expect(dockerService.build).toHaveBeenCalledWith(context.projectPath, {
      file: expectedDockerFile,
      platform: '🖥️',
      buildArgs: {
        NODE_VERSION: 'latest',
        NPM_VERSION: 'latest',
        MY_ARG: 'my-value',
        MY_OTHER_ARG: 'prefix-🏷️',
      },
      tags: [expectedArtefact],
    });
  });

  it('should use the specified Dockerfile, and Node and npm versions', async () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: 'typescript',
        },
        javascript: { node: { version: '18.0.0' }, npm: { version: '7.0.0' } },
        typescript: { serviceContainerDockerfile: 'folder/Dockerfile' },
      },
      functions: [ProjectBuildArtefactForServiceContainer],
    }));
    dockerService = context.service(DockerService);
    const expectedDockerFile = join(context.rootPath, 'folder/Dockerfile');
    jest.spyOn(dockerService, 'build').mockResolvedValueOnce({ code: 0 });

    const actualArtefact = await context.call(ProjectBuildArtefact, {});

    expect(actualArtefact).toBeString();
    expect(dockerService.build).toHaveBeenCalledWith(context.projectPath, {
      file: expectedDockerFile,
      tags: [actualArtefact],
      buildArgs: {
        NODE_VERSION: '18.0.0',
        NPM_VERSION: '7.0.0',
      },
    });
  });
});
