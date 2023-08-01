import { WorkspaceContext } from '@causa/workspace';
import { GitService, ProjectDependenciesUpdate } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import { mkdtemp, rm } from 'fs/promises';
import 'jest-extended';
import { join, resolve } from 'path';
import { NpmService } from '../services/index.js';
import type { ProjectDependenciesUpdateForJavaScript as ProjectDependenciesUpdateForJavaScriptType } from './project-dependencies-update-javascript.js';

// Actually importing `npm-check-updates` is problematic because it relies on `spdx-license-ids` and `spdx-exceptions`,
// which expose `index.json` files with which Jest has problems.
const ncuRunMock = jest.fn((() => Promise.resolve({ 'is-even': '0.1.2' })) as (
  options: any,
) => Promise<Record<string, string>>);
jest.unstable_mockModule('npm-check-updates', () => ({
  default: { run: ncuRunMock },
}));

describe('ProjectDependenciesUpdateForJavaScript', () => {
  let tmpDir: string;
  let context: WorkspaceContext;
  let gitService: GitService;
  let npmService: NpmService;

  let ProjectDependenciesUpdateForJavaScript: typeof ProjectDependenciesUpdateForJavaScriptType;

  beforeEach(async () => {
    ({ ProjectDependenciesUpdateForJavaScript } = await import(
      './project-dependencies-update-javascript.js'
    ));
    tmpDir = resolve(await mkdtemp('causa-test-'));
    ({ context } = createContext({
      workingDirectory: tmpDir,
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'package',
          language: 'javascript',
        },
        javascript: {
          dependencies: {
            update: {
              defaultTarget: 'latest',
              packageTargets: { 'is-even': 'minor' },
            },
          },
        },
      },
      functions: [ProjectDependenciesUpdateForJavaScript],
    }));
    gitService = context.service(GitService);
    npmService = context.service(NpmService);
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should not support projects that are not written in JavaScript or TypeScript', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: { name: 'my-project', type: 'package', language: 'ruby' },
      },
      functions: [ProjectDependenciesUpdateForJavaScript],
    }));

    expect(() => context.call(ProjectDependenciesUpdate, {})).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should throw if the package files contain uncommitted changes', async () => {
    jest.spyOn(gitService, 'filesDiff').mockResolvedValueOnce(['package.json']);

    const actualPromise = context.call(ProjectDependenciesUpdate, {});

    await expect(actualPromise).rejects.toThrow(
      'The package file(s) contain uncommitted changes but would be modified during the update. Changes should be committed or stashed before running the update.',
    );
    expect(gitService.filesDiff).toHaveBeenCalledExactlyOnceWith({
      commit: 'HEAD',
      paths: [join(tmpDir, 'package.json'), join(tmpDir, 'package-lock.json')],
    });
  });

  it('should update the package.json file and run npm update', async () => {
    jest.spyOn(npmService, 'update').mockResolvedValueOnce();

    const actualDidUpdate = await context.call(ProjectDependenciesUpdate, {});

    expect(actualDidUpdate).toBeTrue();
    expect(ncuRunMock).toHaveBeenCalledExactlyOnceWith({
      cwd: tmpDir,
      target: expect.any(Function),
      jsonUpgraded: true,
      upgrade: true,
    });
    const actualTarget = (ncuRunMock.mock.calls[0][0] as any).target;
    expect(actualTarget('is-even')).toEqual('minor');
    expect(actualTarget('is-odd')).toEqual('latest');
    expect(npmService.update).toHaveBeenCalledExactlyOnceWith({
      workingDirectory: tmpDir,
    });
  });

  it('should not run npm update if there are no dependencies to update', async () => {
    jest.spyOn(npmService, 'update').mockResolvedValueOnce();
    ncuRunMock.mockResolvedValueOnce({});

    const actualDidUpdate = await context.call(ProjectDependenciesUpdate, {});

    expect(actualDidUpdate).toBeFalse();
    expect(ncuRunMock).toHaveBeenCalledExactlyOnceWith({
      cwd: tmpDir,
      target: expect.any(Function),
      jsonUpgraded: true,
      upgrade: true,
    });
    expect(npmService.update).not.toHaveBeenCalled();
  });
});
