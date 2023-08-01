import { WorkspaceContext } from '@causa/workspace';
import { ProcessService } from '@causa/workspace-core';
import { createContext } from '@causa/workspace/testing';
import { jest } from '@jest/globals';
import 'jest-extended';
import { major } from 'semver';
import { fileURLToPath } from 'url';
import { IncompatibleNpmVersionError, NpmExitCodeError } from './npm.errors.js';
import { NpmService } from './npm.js';

describe('NpmService', () => {
  let context: WorkspaceContext;
  let service: NpmService;

  beforeEach(() => {
    ({ context } = createContext({
      configuration: {
        workspace: { name: '🏷️' },
        javascript: { npm: { environment: { npm_config_json: '1' } } },
      },
    }));
    service = context.service(NpmService);
  });

  describe('npm', () => {
    it('should spawn the npm command with the specified environment', async () => {
      const rootDir = fileURLToPath(new URL('../../', import.meta.url));

      const actualResult = await service.npm('version', [], {
        capture: { stdout: true },
        workingDirectory: rootDir,
      });

      expect(actualResult.code).toEqual(0);
      // `npm` only returns JSON if `npm_config_json` is set in the environment.
      const actualVersions = JSON.parse(actualResult.stdout ?? '');
      expect(actualVersions.node).toBeDefined();
    });

    it('should throw an error if the command fails', async () => {
      const actualPromise = service.npm('🙅', [], {});

      await expect(actualPromise).rejects.toThrow(NpmExitCodeError);
    });

    it('should throw if the configured npm version is not compatible', async () => {
      ({ context } = createContext({
        configuration: {
          workspace: { name: '🏷️' },
          javascript: { npm: { version: '9999.0.0' } },
        },
      }));
      service = context.service(NpmService);

      const actualPromise = service.npm('version', [], {});

      await expect(actualPromise).rejects.toThrow(IncompatibleNpmVersionError);
      expect(service.requiredVersion).toEqual('9999.0.0');
    });

    it('should validate a compatible npm version', async () => {
      const npmVersionResult = await context
        .service(ProcessService)
        .spawn('npm', ['--version'], { capture: { stdout: true } }).result;
      const currentNpmVersion = npmVersionResult.stdout?.trim() ?? '';
      ({ context } = createContext({
        configuration: {
          workspace: { name: '🏷️' },
          javascript: { npm: { version: `${major(currentNpmVersion)}.0.0` } },
        },
      }));
      service = context.service(NpmService);

      const actualPromise = service.npm('version', [], {});

      await expect(actualPromise).toResolve();
      expect((service as any).npmVersionCheck).toBeDefined();
      expect((service as any).hasCompatibleNpmVersion).toBeTrue();
    });
  });

  describe('build', () => {
    it('should run the build command', async () => {
      jest.spyOn(service, 'npm').mockResolvedValueOnce({ code: 0 });

      await service.build({});

      expect(service.npm).toHaveBeenCalledExactlyOnceWith(
        'run-script',
        ['build'],
        {},
      );
    });
  });

  describe('publish', () => {
    it('should run the publish command', async () => {
      jest.spyOn(service, 'npm').mockResolvedValueOnce({ code: 0 });

      await service.publish({});

      expect(service.npm).toHaveBeenCalledExactlyOnceWith('publish', [], {});
    });
  });

  describe('run', () => {
    it('should run the given script', async () => {
      const expectedResult = { code: 0 };
      jest.spyOn(service, 'npm').mockResolvedValueOnce(expectedResult);

      await service.run('my-script', {
        args: ['--arg1', '--arg2', 'value'],
        capture: { stdout: true },
      });

      expect(service.npm).toHaveBeenCalledExactlyOnceWith(
        'run-script',
        ['my-script', '--', '--arg1', '--arg2', 'value'],
        { capture: { stdout: true } },
      );
    });
  });

  describe('ci', () => {
    it('should run the ci command', async () => {
      jest.spyOn(service, 'npm').mockResolvedValueOnce({ code: 0 });

      await service.ci({});

      expect(service.npm).toHaveBeenCalledExactlyOnceWith('ci', [], {});
    });
  });

  describe('update', () => {
    it('should run the update command', async () => {
      jest.spyOn(service, 'npm').mockResolvedValueOnce({ code: 0 });

      await service.update({});

      expect(service.npm).toHaveBeenCalledExactlyOnceWith('update', [], {});
    });
  });
});
