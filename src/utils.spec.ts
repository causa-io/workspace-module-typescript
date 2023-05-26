import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  makeNpmPackageArtefactDestination,
  readNpmPackageFile,
} from './utils.js';

describe('utils', () => {
  describe('readNpmPackageFile', () => {
    let tmpDir: string;

    beforeEach(async () => {
      tmpDir = await mkdtemp(join(tmpdir(), 'causa-test-'));
    });

    afterEach(async () => {
      await rm(tmpDir, { recursive: true, force: true });
    });

    it('should read the package file', async () => {
      const expectedPackageInfo = {
        name: 'test-package',
        version: '1.0.0',
      };
      await writeFile(
        join(tmpDir, 'package.json'),
        JSON.stringify(expectedPackageInfo),
      );

      const actualPackageInfo = await readNpmPackageFile(tmpDir);

      expect(actualPackageInfo).toEqual(expectedPackageInfo);
    });
  });

  describe('makeNpmPackageArtefactDestination', () => {
    it('should construct the destination', () => {
      const actualDestination = makeNpmPackageArtefactDestination({
        name: 'test-package',
        version: '1.0.0',
      });

      expect(actualDestination).toEqual('test-package@1.0.0');
    });

    it('should overwrite the version', () => {
      const actualDestination = makeNpmPackageArtefactDestination(
        { name: 'test-package', version: '1.0.0' },
        '2.0.0',
      );

      expect(actualDestination).toEqual('test-package@2.0.0');
    });
  });
});
