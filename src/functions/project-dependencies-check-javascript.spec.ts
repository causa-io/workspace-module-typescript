import { WorkspaceContext } from '@causa/workspace';
import { ProjectDependenciesCheck } from '@causa/workspace-core';
import { NoImplementationFoundError } from '@causa/workspace/function-registry';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import type { ProjectDependenciesCheckForJavaScript as ProjectDependenciesCheckForJavaScriptType } from './project-dependencies-check-javascript.js';

const allowlistInstanceMock = {};
const AllowlistMock = {
  mapConfigToAllowlist: jest.fn().mockReturnValue(allowlistInstanceMock),
};
const npmAuditMock = jest.fn(() => Promise.resolve());
jest.unstable_mockModule('audit-ci', () => ({
  Allowlist: AllowlistMock,
  npmAudit: npmAuditMock,
  mapVulnerabilityLevelInput: (object: any) => ({ levelInput: object }),
}));

describe('ProjectDependenciesCheckForJavaScript', () => {
  let context: WorkspaceContext;
  let ProjectDependenciesCheckForJavaScript: typeof ProjectDependenciesCheckForJavaScriptType;

  beforeEach(async () => {
    ({ ProjectDependenciesCheckForJavaScript } = await import(
      './project-dependencies-check-javascript.js'
    ));
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'package',
          language: 'javascript',
        },
      },
      functions: [ProjectDependenciesCheckForJavaScript],
    }));
  });

  it('should not support projects that are not written in JavaScript or TypeScript', () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: { name: 'my-project', type: 'package', language: 'ruby' },
      },
      functions: [ProjectDependenciesCheckForJavaScript],
    }));

    expect(() => context.call(ProjectDependenciesCheck, {})).toThrow(
      NoImplementationFoundError,
    );
  });

  it('should call npmAudit on the project', async () => {
    await context.call(ProjectDependenciesCheck, {});

    expect(npmAuditMock).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        directory: context.projectPath,
        'report-type': 'summary',
        allowlist: [],
        'skip-dev': false,
        // Expected from the output of the mocked mapVulnerabilityLevelInput function.
        levelInput: { low: true },
      }),
    );
  });

  it('should pass an allowlist, skip dev dependencies and set the correct level', async () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'package',
          language: 'javascript',
        },
        javascript: {
          dependencies: {
            check: { skipDev: true, level: 'moderate', allowlist: ['foo'] },
          },
        },
      },
      functions: [ProjectDependenciesCheckForJavaScript],
    }));

    await context.call(ProjectDependenciesCheck, {});

    expect(npmAuditMock).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        directory: context.projectPath,
        'report-type': 'summary',
        allowlist: ['foo'],
        'skip-dev': true,
        // Expected from the output of the mocked mapVulnerabilityLevelInput function.
        levelInput: { moderate: true },
      }),
    );
  });

  it('should throw for an invalid level', async () => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        project: {
          name: 'my-project',
          type: 'package',
          language: 'javascript',
        },
        javascript: { dependencies: { check: { level: '🚨' } } },
      },
      functions: [ProjectDependenciesCheckForJavaScript],
    }));

    const actualPromise = context.call(ProjectDependenciesCheck, {});

    await expect(actualPromise).rejects.toThrow(
      `Invalid dependencies check level '🚨'.`,
    );
  });
});
