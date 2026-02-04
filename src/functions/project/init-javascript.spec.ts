import { WorkspaceContext } from '@causa/workspace';
import { ProjectInit } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import { mkdtemp, rm } from 'fs/promises';
import 'jest-extended';
import { resolve } from 'path';
import { NpmService } from '../../services/index.js';
import { ProjectInitForJavaScript } from './init-javascript.js';

describe('ProjectInitForJavaScript', () => {
  let tmpDir: string;
  let context: WorkspaceContext;
  let npmService: NpmService;

  beforeEach(async () => {
    tmpDir = resolve(await mkdtemp('causa-test-'));
    ({ context } = createContext({
      projectPath: tmpDir,
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'package',
          language: 'javascript',
        },
      },
      functions: [ProjectInitForJavaScript],
    }));
    npmService = context.service(NpmService);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should not support projects that are not written in JavaScript or TypeScript', () => {
    ({ context } = createContext({
      projectPath: tmpDir,
      configuration: {
        workspace: { name: '🏷️' },
        project: { name: 'my-project', type: 'package', language: 'ruby' },
      },
      functions: [ProjectInitForJavaScript],
    }));

    expect(() => context.call(ProjectInit, {})).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should run npm ci', async () => {
    jest.spyOn(npmService, 'ci').mockResolvedValueOnce();

    await context.call(ProjectInit, {});

    expect(npmService.ci).toHaveBeenCalledExactlyOnceWith({
      logging: { stdout: null, stderr: 'info' },
      workingDirectory: tmpDir,
    });
  });
});
