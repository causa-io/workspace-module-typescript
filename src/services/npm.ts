import { WorkspaceContext } from '@causa/workspace';
import {
  ProcessService,
  ProcessServiceExitCodeError,
  type SpawnOptions,
  type SpawnedProcessResult,
} from '@causa/workspace-core/services';
import { satisfies } from 'semver';
import { IncompatibleNpmVersionError, NpmExitCodeError } from './npm.errors.js';

/**
 * A service exposing the npm CLI.
 */
export class NpmService {
  /**
   * The underlying {@link ProcessService} spawning the npm CLI.
   */
  private readonly processService: ProcessService;

  /**
   * The environment that should be provided to the npm process.
   * This is read and rendered from the `javascript.npm.environment` configuration.
   */
  readonly environment: Promise<Record<string, any> | undefined>;

  /**
   * The required npm version set in the configuration.
   * Defaults to `latest`.
   */
  readonly requiredVersion: string;

  constructor(context: WorkspaceContext) {
    this.processService = context.service(ProcessService);
    this.environment = context.getAndRender('javascript.npm.environment');
    this.requiredVersion = context.get('javascript.npm.version') ?? 'latest';
  }

  /**
   * Runs `npm run build`.
   * Specify the {@link SpawnOptions.workingDirectory} to set the package on which the command is run.
   *
   * @param options {@link SpawnOptions} for the process.
   */
  async build(options: SpawnOptions = {}): Promise<void> {
    await this.run('build', options);
  }

  /**
   * Runs `npm pack` and returns the name of the generated archive.
   * Specify the {@link SpawnOptions.workingDirectory} to set the package on which the command is run.
   *
   * @param options Options for the pack command, including optional pack destination and {@link SpawnOptions}.
   * @returns The name of the generated archive file.
   */
  async pack(
    options: {
      /**
       * The destination directory for the packed archive.
       */
      packDestination?: string;
    } & SpawnOptions = {},
  ): Promise<string> {
    const { packDestination, ...spawnOptions } = options;
    const args = packDestination ? ['--pack-destination', packDestination] : [];

    const result = await this.npm('pack', args, {
      ...spawnOptions,
      capture: { ...spawnOptions.capture, stdout: true },
    });

    const archiveName = result.stdout?.trim();
    if (!archiveName) {
      throw new Error('Failed to get archive name from npm pack output.');
    }

    return archiveName;
  }

  /**
   * Runs `npm publish`.
   * Specify the {@link SpawnOptions.workingDirectory} to set the package on which the command is run.
   *
   * @param options Options for the publish command, including optional package spec and {@link SpawnOptions}.
   */
  async publish(
    options: {
      /**
       * The path to an archive file to publish instead of the current directory.
       */
      packageSpec?: string;
    } & SpawnOptions = {},
  ): Promise<void> {
    const { packageSpec, ...spawnOptions } = options;
    const args = packageSpec ? [packageSpec] : [];
    await this.npm('publish', args, spawnOptions);
  }

  /**
   * Runs an npm script using `npm run <command> -- [args...]`.
   * Specify the {@link SpawnOptions.workingDirectory} to set the package on which the command is run.
   *
   * @param script The name of the npm script to run.
   * @param options Optional arguments for the script and {@link SpawnOptions} for the process.
   */
  async run(
    script: string,
    options: {
      /**
       * Arguments passed after the arguments separator (`--`) to the npm script.
       */
      args?: string[];
    } & SpawnOptions = {},
  ): Promise<SpawnedProcessResult> {
    const { args, ...spawnOptions } = options;
    return await this.npm(
      'run-script',
      [script, ...(args && args.length > 0 ? ['--', ...args] : [])],
      spawnOptions,
    );
  }

  /**
   * Runs `npm ci`.
   * Specify the {@link SpawnOptions.workingDirectory} to set the package on which the command is run.
   *
   * @param options {@link SpawnOptions} for the process.
   */
  async ci(options: SpawnOptions = {}): Promise<void> {
    await this.npm('ci', [], options);
  }

  /**
   * Runs `npm update`.
   * Specify the {@link SpawnOptions.workingDirectory} to set the package on which the command is run.
   *
   * @param options {@link SpawnOptions} for the process.
   */
  async update(options: SpawnOptions = {}): Promise<void> {
    await this.npm('update', [], options);
  }

  /**
   * Runs an arbitrary npm command.
   *
   * @param command The npm command to run.
   * @param args Arguments to place after the command name.
   * @param options {@link SpawnOptions} for the process.
   * @returns The result of the spawned process.
   */
  async npm(
    command: string,
    args: string[],
    options: SpawnOptions = {},
  ): Promise<SpawnedProcessResult> {
    await this.checkNpmVersion();

    const defaultEnvironment = (await this.environment) ?? {};

    try {
      const p = this.processService.spawn('npm', [command, ...args], {
        capture: { stderr: true },
        ...options,
        environment: options.environment ?? {
          ...process.env,
          ...defaultEnvironment,
        },
      });
      return await p.result;
    } catch (error) {
      if (error instanceof ProcessServiceExitCodeError) {
        throw new NpmExitCodeError(error);
      }

      throw error;
    }
  }

  /**
   * Whether the installed npm version is compatible with the required version set in the configuration.
   * It is `undefined` before the first call to {@link NpmService.checkNpmVersion}.
   */
  private hasCompatibleNpmVersion: boolean | undefined;

  /**
   * A promise that resolves when the installed npm version has been checked.
   * It is `undefined` before the first call to {@link NpmService.checkNpmVersion}, or if the actual check is not
   * needed.
   */
  private npmVersionCheck: Promise<void> | undefined;

  /**
   * Checks whether the installed npm version is compatible with the required version set in the configuration.
   * If the required version is `latest`, the check is skipped.
   * If the installed version is not compatible, an {@link IncompatibleNpmVersionError} is thrown.
   * The result of the check is cached, and this returns synchronously on subsequent calls.
   */
  private async checkNpmVersion(): Promise<void> {
    if (this.hasCompatibleNpmVersion === true) {
      return;
    }

    if (this.requiredVersion === 'latest') {
      this.hasCompatibleNpmVersion = true;
      return;
    }

    if (!this.npmVersionCheck) {
      this.npmVersionCheck = (async () => {
        const result = await this.processService.spawn('npm', ['--version'], {
          capture: { stdout: true },
        }).result;
        const version = (result.stdout ?? '').trim();

        this.hasCompatibleNpmVersion = satisfies(
          version,
          `^${this.requiredVersion}`,
        );

        if (!this.hasCompatibleNpmVersion) {
          throw new IncompatibleNpmVersionError(version, this.requiredVersion);
        }
      })();
    }

    await this.npmVersionCheck;
  }
}
