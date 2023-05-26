import { WorkspaceContext } from '@causa/workspace';
import {
  ProcessService,
  ProcessServiceExitCodeError,
  SpawnOptions,
  SpawnedProcessResult,
} from '@causa/workspace-core';
import { NpmExitCodeError } from './npm.errors.js';

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

  constructor(context: WorkspaceContext) {
    this.processService = context.service(ProcessService);
    this.environment = context.getAndRender('javascript.npm.environment');
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
   * Runs `npm publish`.
   * Specify the {@link SpawnOptions.workingDirectory} to set the package on which the command is run.
   *
   * @param options {@link SpawnOptions} for the process.
   */
  async publish(options: SpawnOptions = {}): Promise<void> {
    await this.npm('publish', [], options);
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
}
