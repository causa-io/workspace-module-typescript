import { WorkspaceContext } from '@causa/workspace';
import { DockerService, ProjectBuildArtefact } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { ProjectBuildArtefactForTypeScriptServiceContainer } from './project-build-artefact-ts-service-container.js';

describe('ProjectBuildArtefactForTypeScriptServiceContainer', () => {
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
      functions: [ProjectBuildArtefactForTypeScriptServiceContainer],
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
    const expectedDockerFile = fileURLToPath(
      new URL(
        '../assets/Dockerfile-typescript-service-container',
        import.meta.url,
      ),
    );
    jest.spyOn(dockerService, 'build').mockResolvedValueOnce({ code: 0 });

    const actualArtefact = await context.call(ProjectBuildArtefact, {});

    expect(actualArtefact).toBeString();
    expect(dockerService.build).toHaveBeenCalledExactlyOnceWith(
      context.projectPath,
      {
        file: expectedDockerFile,
        platform: '🖥️',
        buildArgs: {
          NODE_VERSION: 'latest',
          NODE_MAJOR_VERSION: '20',
          NPM_VERSION: 'latest',
          MY_ARG: 'my-value',
          MY_OTHER_ARG: 'prefix-🏷️',
        },
        tags: [actualArtefact],
      },
    );
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
    expect(dockerService.build).toHaveBeenCalledExactlyOnceWith(
      context.projectPath,
      {
        file: expectedDockerFile,
        platform: '🖥️',
        buildArgs: {
          NODE_VERSION: 'latest',
          NODE_MAJOR_VERSION: '20',
          NPM_VERSION: 'latest',
          MY_ARG: 'my-value',
          MY_OTHER_ARG: 'prefix-🏷️',
        },
        tags: [expectedArtefact],
      },
    );
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
        javascript: { node: { version: '18.1.0' }, npm: { version: '7.0.0' } },
        typescript: { serviceContainerDockerfile: 'folder/Dockerfile' },
      },
      functions: [ProjectBuildArtefactForTypeScriptServiceContainer],
    }));
    dockerService = context.service(DockerService);
    const expectedDockerFile = join(context.rootPath, 'folder/Dockerfile');
    jest.spyOn(dockerService, 'build').mockResolvedValueOnce({ code: 0 });

    const actualArtefact = await context.call(ProjectBuildArtefact, {});

    expect(actualArtefact).toBeString();
    expect(dockerService.build).toHaveBeenCalledExactlyOnceWith(
      context.projectPath,
      {
        file: expectedDockerFile,
        tags: [actualArtefact],
        buildArgs: {
          NODE_VERSION: '18.1.0',
          NODE_MAJOR_VERSION: '18',
          NPM_VERSION: '7.0.0',
        },
      },
    );
  });
});
