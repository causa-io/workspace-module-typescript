import { WorkspaceContext } from '@causa/workspace';
import {
  ProcessServiceExitCodeError,
  ProjectLint,
} from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { NpmExitCodeError, NpmService } from '../services/index.js';
import { ProjectLintForJavaScript } from './project-lint-javascript.js';

describe('ProjectLinForJavaScript', () => {
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
      functions: [ProjectLintForJavaScript],
    }));
    npmService = context.service(NpmService);
  });

  it('should not support projects that are not written in JavaScript or TypeScript', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: { name: 'my-project', type: 'package', language: 'ruby' },
      },
      functions: [ProjectLintForJavaScript],
    }));

    expect(() => context.call(ProjectLint, {})).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should run the lint script', async () => {
    jest.spyOn(npmService, 'run').mockResolvedValueOnce({ code: 0 });

    await context.call(ProjectLint, {});

    expect(npmService.run).toHaveBeenCalledExactlyOnceWith('lint', {
      workingDirectory: context.projectPath,
      logging: 'info',
    });
  });

  it('should throw an error when linting fails', async () => {
    jest
      .spyOn(npmService, 'run')
      .mockRejectedValueOnce(
        new NpmExitCodeError(
          new ProcessServiceExitCodeError('npm', [], { code: 1 }),
        ),
      );

    const actualPromise = context.call(ProjectLint, {});

    await expect(actualPromise).rejects.toThrow('Code failed linter checks.');
    expect(npmService.run).toHaveBeenCalledExactlyOnceWith('lint', {
      workingDirectory: context.projectPath,
      logging: 'info',
    });
  });
});
