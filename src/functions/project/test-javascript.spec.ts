import { WorkspaceContext } from '@causa/workspace';
import { ProjectTest } from '@causa/workspace-core';
import { ProcessServiceExitCodeError } from '@causa/workspace-core/services';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { NpmExitCodeError, NpmService } from '../../services/index.js';
import { ProjectTestForJavaScript } from './test-javascript.js';

describe('ProjectTestForJavaScript', () => {
  let context: WorkspaceContext;
  let npmService: NpmService;

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
      functions: [ProjectTestForJavaScript],
    }));
    npmService = context.service(NpmService);
  });

  it('should not support projects that are not written in JavaScript or TypeScript', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: { name: 'my-project', type: 'package', language: 'ruby' },
      },
      functions: [ProjectTestForJavaScript],
    }));

    expect(() => context.call(ProjectTest, {})).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should run the test script', async () => {
    jest.spyOn(npmService, 'run').mockResolvedValueOnce({ code: 0 });

    await context.call(ProjectTest, {});

    expect(npmService.run).toHaveBeenCalledExactlyOnceWith('test', {
      workingDirectory: context.projectPath,
      logging: 'info',
    });
  });

  it('should run the test coverage script', async () => {
    jest.spyOn(npmService, 'run').mockResolvedValueOnce({ code: 0 });

    await context.call(ProjectTest, { coverage: true });

    expect(npmService.run).toHaveBeenCalledExactlyOnceWith('test:cov', {
      workingDirectory: context.projectPath,
      logging: 'info',
    });
  });

  it('should throw an error when tests fail', async () => {
    jest
      .spyOn(npmService, 'run')
      .mockRejectedValueOnce(
        new NpmExitCodeError(
          new ProcessServiceExitCodeError('npm', [], { code: 1 }),
        ),
      );

    const actualPromise = context.call(ProjectTest, {});

    await expect(actualPromise).rejects.toThrow('Code failed tests.');
    expect(npmService.run).toHaveBeenCalledExactlyOnceWith('test', {
      workingDirectory: context.projectPath,
      logging: 'info',
    });
  });
});
