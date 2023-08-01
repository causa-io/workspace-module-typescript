import { WorkspaceContext } from '@causa/workspace';
import { GitService, ProjectDependenciesUpdate } from '@causa/workspace-core';
import ncu from 'npm-check-updates';
import { join } from 'path';
import { NpmService, TypeScriptConfiguration } from '../index.js';
import { PACKAGE_FILE, PACKAGE_LOCK_FILE } from '../utils.js';

/**
 * Implements the {@link ProjectDependenciesUpdate} function for JavaScript and TypeScript projects.
 * This uses `npm-check-updates` to update the dependencies in the `package.json` file and then runs `npm update` to
 * download the new dependencies, update the indirect dependencies and update the `package-lock.json` file.
 */
export class ProjectDependenciesUpdateForJavaScript extends ProjectDependenciesUpdate {
  async _call(context: WorkspaceContext): Promise<boolean> {
    const projectPath = context.getProjectPathOrThrow();
    const conf = context.asConfiguration<TypeScriptConfiguration>();
    const defaultTarget =
      conf.get('javascript.dependencies.update.defaultTarget') ?? 'latest';
    const packageTargets =
      conf.get('javascript.dependencies.update.packageTargets') ?? {};

    const packageFiles = [PACKAGE_FILE, PACKAGE_LOCK_FILE].map((file) =>
      join(projectPath, file),
    );
    const changedFiles = await context.service(GitService).filesDiff({
      commit: 'HEAD',
      paths: packageFiles,
    });
    if (changedFiles.length > 0) {
      throw new Error(
        `The package file(s) contain uncommitted changes but would be modified during the update. Changes should be committed or stashed before running the update.`,
      );
    }

    context.logger.info(`⬆️ Updating dependencies in 'package.json'.`);
    const upgrades = await ncu.run({
      cwd: projectPath,
      target: (dependencyName) =>
        packageTargets[dependencyName] ?? defaultTarget,
      jsonUpgraded: true,
      upgrade: true,
    });

    if (!upgrades || Object.keys(upgrades).length === 0) {
      context.logger.info(`✅ No dependency to update.`);
      return false;
    } else {
      context.logger.info(
        `⬆️ Upgraded the following dependencies:\n${Object.entries(upgrades)
          .map(([name, version]) => `  ${name} => ${version}`)
          .join('\n')}.`,
      );
    }

    context.logger.info(`⬆️ Running 'npm update'.`);
    await context.service(NpmService).update({ workingDirectory: projectPath });

    return true;
  }

  _supports(context: WorkspaceContext): boolean {
    return ['javascript', 'typescript'].includes(
      context.get('project.language') ?? '',
    );
  }
}
