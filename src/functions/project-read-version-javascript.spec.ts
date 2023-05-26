import { WorkspaceContext } from '@causa/workspace';
import { ProjectReadVersion } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { ProjectReadVersionForJavascript } from './project-read-version-javascript.js';

describe('ProjectReadVersionForJavascript', () => {
  let tmpDir: string;
  let context: WorkspaceContext;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'causa-test-'));
    ({ context } = createContext({
      projectPath: tmpDir,
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: 'typescript',
        },
      },
      functions: [ProjectReadVersionForJavascript],
    }));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should not handle projects with unsupported languages', async () => {
    ({ context } = createContext({
      projectPath: tmpDir,
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'serviceContainer',
          language: 'python',
        },
      },
      functions: [ProjectReadVersionForJavascript],
    }));

    expect(() => context.call(ProjectReadVersion, {})).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should read the version from the package file', async () => {
    const expectedVersion = '1.0.0';
    await writeFile(
      join(tmpDir, 'package.json'),
      JSON.stringify({ version: expectedVersion }),
    );

    const actualVersion = await context.call(ProjectReadVersion, {});

    expect(actualVersion).toEqual(expectedVersion);
  });
});
