import type { WorkspaceContext } from '@causa/workspace';
import { GitService } from '@causa/workspace-core/services';
import { run } from 'npm-check-updates';
import { join } from 'path';
import type { TypeScriptConfiguration } from '../../configurations/index.js';
import { NpmService } from '../../services/index.js';
import { PACKAGE_FILE, PACKAGE_LOCK_FILE } from '../../utils.js';
import type { ProjectDependenciesUpdateForJavaScript } from './dependencies-update-javascript.js';

/**
 * Checks whether the package files have uncommitted changes.
 *
 * @param context The workspace context.
 * @returns `true` if the package files have uncommitted changes.
 */
async function hasUncommittedPackageChanges(
  context: WorkspaceContext,
): Promise<boolean> {
  const projectPath = context.getProjectPathOrThrow();
  const packageFiles = [PACKAGE_FILE, PACKAGE_LOCK_FILE].map((file) =>
    join(projectPath, file),
  );

  const changedFiles = await context.service(GitService).filesDiff({
    commits: ['HEAD'],
    paths: packageFiles,
  });

  return changedFiles.length > 0;
}

/**
 * Runs `npm-check-updates` to look for dependency updates, possibly writing the `package.json` in the process.
 *
 * @param context The workspace context.
 * @returns The upgraded dependencies, as a map of dependency name to new version.
 */
async function lookForUpdates(
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
    target: (dependencyName) => packageTargets[dependencyName] ?? defaultTarget,
    jsonUpgraded: true,
    upgrade: true,
    deprecated: false,
  });

  process.env = previousEnv;

  return (upgrades as any) ?? {};
}

export default async function call(
  this: ProjectDependenciesUpdateForJavaScript,
): Promise<boolean> {
  const projectPath = this._context.getProjectPathOrThrow();

  if (await hasUncommittedPackageChanges(this._context)) {
    throw new Error(
      `The package file(s) contain uncommitted changes but would be modified during the update. Changes should be committed or stashed before running the update.`,
    );
  }

  const upgrades = await lookForUpdates(this._context);
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
    const hasIndirectUpdates = await hasUncommittedPackageChanges(
      this._context,
    );
    if (!hasIndirectUpdates) {
      this._context.logger.info(`✅ No dependency to update.`);
      return false;
    }

    this._context.logger.info(`⬆️ Indirect dependencies have been updated.`);
  }

  return true;
}
