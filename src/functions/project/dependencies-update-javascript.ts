import { ProjectDependenciesUpdate } from '@causa/workspace-core';
import { GitService } from '@causa/workspace-core/services';
import { run } from 'npm-check-updates';
import { join } from 'path';
import type { TypeScriptConfiguration } from '../../configurations/index.js';
import { NpmService } from '../../services/index.js';
import { PACKAGE_FILE, PACKAGE_LOCK_FILE } from '../../utils.js';

/**
 * Implements the {@link ProjectDependenciesUpdate} function for JavaScript and TypeScript projects.
 * This uses `npm-check-updates` to update the dependencies in the `package.json` file and then runs `npm update` to
 * download the new dependencies, update the indirect dependencies and update the `package-lock.json` file.
 */
export class ProjectDependenciesUpdateForJavaScript extends ProjectDependenciesUpdate {
  async _call(): Promise<boolean> {
    const projectPath = this._context.getProjectPathOrThrow();

    if (await this.hasUncommittedPackageChanges()) {
      throw new Error(
        `The package file(s) contain uncommitted changes but would be modified during the update. Changes should be committed or stashed before running the update.`,
      );
    }

    const upgrades = await this.lookForUpdates();
    const hasDirectUpdates = Object.keys(upgrades).length > 0;
    if (hasDirectUpdates) {
      this._context.logger.info(
        `⬆️ Upgraded the following dependencies:\n${Object.entries(upgrades)
          .map(([name, version]) => `  ${name} => ${version}`)
          .join('\n')}.`,
      );
    }

    this._context.logger.info(`⬆️ Running 'npm update'.`);
    await this._context
      .service(NpmService)
      .update({ workingDirectory: projectPath });

    if (!hasDirectUpdates) {
      const hasIndirectUpdates = await this.hasUncommittedPackageChanges();
      if (!hasIndirectUpdates) {
        this._context.logger.info(`✅ No dependency to update.`);
        return false;
      }

      this._context.logger.info(`⬆️ Indirect dependencies have been updated.`);
    }

    return true;
  }

  _supports(): boolean {
    return ['javascript', 'typescript'].includes(
      this._context.get('project.language') ?? '',
    );
  }

  /**
   * Checks whether the package files have uncommitted changes.
   *
   * @returns `true` if the package files have uncommitted changes.
   */
  private async hasUncommittedPackageChanges(): Promise<boolean> {
    const projectPath = this._context.getProjectPathOrThrow();
    const packageFiles = [PACKAGE_FILE, PACKAGE_LOCK_FILE].map((file) =>
      join(projectPath, file),
    );

    const changedFiles = await this._context.service(GitService).filesDiff({
      commits: ['HEAD'],
      paths: packageFiles,
    });

    return changedFiles.length > 0;
  }

  /**
   * Runs `npm-check-updates` to look for dependency updates, possibly writing the `package.json` in the process.
   *
   * @returns The upgraded dependencies, as a map of dependency name to new version.
   */
  private async lookForUpdates(): Promise<Record<string, string>> {
    this._context.logger.info(`⬆️ Updating dependencies in 'package.json'.`);

    const projectPath = this._context.getProjectPathOrThrow();
    const conf = this._context.asConfiguration<TypeScriptConfiguration>();
    const defaultTarget =
      conf.get('javascript.dependencies.update.defaultTarget') ?? 'latest';
    const packageTargets =
      conf.get('javascript.dependencies.update.packageTargets') ?? {};

    const previousEnv = { ...process.env };
    const environment = await this._context.service(NpmService).environment;
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
