import { WorkspaceContext } from '@causa/workspace';
import {
  DockerService,
  ProcessServiceExitCodeError,
  ProjectSecurityCheck,
} from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { NpmService } from '../../services/index.js';
import { ProjectSecurityCheckForJavaScript } from './security-check.js';

describe('ProjectSecurityCheckForJavaScript', () => {
  let context: WorkspaceContext;
  let dockerService: DockerService;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'package',
          language: 'javascript',
        },
      },
      functions: [ProjectSecurityCheckForJavaScript],
    }));
    dockerService = context.service(DockerService);
  });

  it('should not support projects that are not written in JavaScript or TypeScript', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: { name: 'my-project', type: 'package', language: 'ruby' },
      },
      functions: [ProjectSecurityCheckForJavaScript],
    }));

    expect(() => context.call(ProjectSecurityCheck, {})).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should run the njsscan Docker image', async () => {
    jest.spyOn(dockerService, 'run').mockResolvedValueOnce({ code: 0 });

    await context.call(ProjectSecurityCheck, {});

    expect(dockerService.run).toHaveBeenCalledExactlyOnceWith(
      'opensecurity/njsscan',
      {
        rm: true,
        mounts: [
          {
            type: 'bind',
            source: context.projectPath,
            destination: '/workdir',
            readonly: true,
          },
        ],
        commandAndArgs: ['-w', '/workdir'],
        logging: 'info',
      },
    );
  });

  it('should build the project for a TypeScript project before running checks', async () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'package',
          language: 'typescript',
        },
      },
      functions: [ProjectSecurityCheckForJavaScript],
    }));
    dockerService = context.service(DockerService);
    const npmService = context.service(NpmService);
    jest.spyOn(dockerService, 'run').mockResolvedValueOnce({ code: 0 });
    jest.spyOn(npmService, 'build').mockResolvedValueOnce();

    await context.call(ProjectSecurityCheck, {});

    expect(npmService.build).toHaveBeenCalledExactlyOnceWith({
      workingDirectory: context.projectPath,
    });
    expect(dockerService.run).toHaveBeenCalledExactlyOnceWith(
      'opensecurity/njsscan',
      {
        rm: true,
        mounts: [
          {
            type: 'bind',
            source: context.projectPath,
            destination: '/workdir',
            readonly: true,
          },
        ],
        commandAndArgs: ['-w', '/workdir'],
        logging: 'info',
      },
    );
  });

  it('should throw an error when scanning fails', async () => {
    jest
      .spyOn(dockerService, 'run')
      .mockRejectedValueOnce(
        new ProcessServiceExitCodeError('docker', [], { code: 1 }),
      );

    const actualPromise = context.call(ProjectSecurityCheck, {});

    await expect(actualPromise).rejects.toThrow('Code failed security checks.');
    expect(dockerService.run).toHaveBeenCalledExactlyOnceWith(
      'opensecurity/njsscan',
      {
        rm: true,
        mounts: [
          {
            type: 'bind',
            source: context.projectPath,
            destination: '/workdir',
            readonly: true,
          },
        ],
        commandAndArgs: ['-w', '/workdir'],
        logging: 'info',
      },
    );
  });
});
