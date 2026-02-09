import { WorkspaceContext } from '@causa/workspace';
import { ProjectDependenciesUpdate } from '@causa/workspace-core';
import { GitService } from '@causa/workspace-core/services';
import { run } from 'npm-check-updates';
import { join } from 'path';
import { NpmService, type TypeScriptConfiguration } from '../../index.js';
import { PACKAGE_FILE, PACKAGE_LOCK_FILE } from '../../utils.js';

/**
 * Implements the {@link ProjectDependenciesUpdate} function for JavaScript and TypeScript projects.
 * This uses `npm-check-updates` to update the dependencies in the `package.json` file and then runs `npm update` to
 * download the new dependencies, update the indirect dependencies and update the `package-lock.json` file.
 */
export class ProjectDependenciesUpdateForJavaScript extends ProjectDependenciesUpdate {
  async _call(context: WorkspaceContext): Promise<boolean> {
    const projectPath = context.getProjectPathOrThrow();

    await this.checkForUncommittedChanges(context);

    const upgrades = await this.lookForUpdates(context);
    if (!upgrades || Object.keys(upgrades).length === 0) {
      context.logger.info(`✅ No dependency to update.`);
      return false;
    }

    context.logger.info(
      `⬆️ Upgraded the following dependencies:\n${Object.entries(upgrades)
        .map(([name, version]) => `  ${name} => ${version}`)
        .join('\n')}.`,
    );

    context.logger.info(`⬆️ Running 'npm update'.`);
    await context.service(NpmService).update({ workingDirectory: projectPath });

    return true;
  }

  _supports(context: WorkspaceContext): boolean {
    return ['javascript', 'typescript'].includes(
      context.get('project.language') ?? '',
    );
  }

  /**
   * Ensures that there are no uncommitted changes in the package files.
   *
   * @param context The {@link WorkspaceContext}.
   */
  private async checkForUncommittedChanges(
    context: WorkspaceContext,
  ): Promise<void> {
    const projectPath = context.getProjectPathOrThrow();
    const packageFiles = [PACKAGE_FILE, PACKAGE_LOCK_FILE].map((file) =>
      join(projectPath, file),
    );

    const changedFiles = await context.service(GitService).filesDiff({
      commits: ['HEAD'],
      paths: packageFiles,
    });

    if (changedFiles.length > 0) {
      throw new Error(
        `The package file(s) contain uncommitted changes but would be modified during the update. Changes should be committed or stashed before running the update.`,
      );
    }
  }

  /**
   * Runs `npm-check-updates` to look for dependency updates, possibly writing the `package.json` in the process.
   *
   * @param context The {@link WorkspaceContext}.
   * @returns The upgraded dependencies, as a map of dependency name to new version.
   */
  private async lookForUpdates(
    context: WorkspaceContext,
  ): Promise<Record<string, string>> {
    context.logger.info(`⬆️ Updating dependencies in 'package.json'.`);

    const projectPath = context.getProjectPathOrThrow();
    const conf = context.asConfiguration<TypeScriptConfiguration>();
    const defaultTarget =
      conf.get('javascript.dependencies.update.defaultTarget') ?? 'latest';
    const packageTargets =
      conf.get('javascript.dependencies.update.packageTargets') ?? {};

    const previousEnv = { ...process.env };
    const environment = await context.service(NpmService).environment;
    process.env = { ...previousEnv, ...environment };

    const upgrades = await run({
      cwd: projectPath,
      target: (dependencyName) =>
        packageTargets[dependencyName] ?? defaultTarget,
      jsonUpgraded: true,
      upgrade: true,
    });

    process.env = previousEnv;

    return (upgrades as any) ?? {};
  }
}
