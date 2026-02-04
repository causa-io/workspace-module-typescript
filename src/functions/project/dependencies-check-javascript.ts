import { WorkspaceContext } from '@causa/workspace';
import { ProjectDependenciesCheck } from '@causa/workspace-core';
import type { VulnerabilityLevels } from 'audit-ci';
import { mapVulnerabilityLevelInput, npmAudit } from 'audit-ci';
import type { TypeScriptConfiguration } from '../../configurations/index.js';

/**
 * A valid vulnerability level of `audit-ci`.
 */
type VulnerabilityLevel = keyof VulnerabilityLevels;

/**
 * The default vulnerability level failing the dependencies check.
 */
const DEFAULT_VULNERABILITY_LEVEL: VulnerabilityLevel = 'low';

/**
 * The list of allowed vulnerability levels, defined by `audit-ci`.
 */
const ALLOWED_VULNERABILITY_LEVELS: VulnerabilityLevel[] = [
  'low',
  'moderate',
  'high',
  'critical',
];

/**
 * Implements the {@link ProjectDependenciesCheck} function for JavaScript and TypeScript projects.
 * This uses `audit-ci`, which is a wrapper around `npm audit`.
 */
export class ProjectDependenciesCheckForJavaScript extends ProjectDependenciesCheck {
  async _call(context: WorkspaceContext): Promise<void> {
    const conf = context.asConfiguration<TypeScriptConfiguration>();
    const level = conf.get('javascript.dependencies.check.level');
    const skipDev = conf.get('javascript.dependencies.check.skipDev');
    const allowlist = conf.get('javascript.dependencies.check.allowlist');

    if (level && !ALLOWED_VULNERABILITY_LEVELS.includes(level)) {
      throw new Error(`Invalid dependencies check level '${level}'.`);
    }

    context.logger.info('🔍 Checking for vulnerable dependencies.');

    await this.auditDependencies(context, { allowlist, skipDev, level });

    context.logger.info('✅ No vulnerable dependency found.');
  }

  _supports(context: WorkspaceContext): boolean {
    return ['javascript', 'typescript'].includes(
      context.get('project.language') ?? '',
    );
  }

  /**
   * Audits the dependencies of the project using `audit-ci`.
   * Handles the mapping of `audit-ci` options.
   *
   * @param context The workspace context.
   * @param options Options when auditing dependencies.
   */
  private async auditDependencies(
    context: WorkspaceContext,
    options: {
      allowlist?: string[];
      skipDev?: boolean;
      level?: VulnerabilityLevel;
    } = {},
  ): Promise<void> {
    const projectPath = context.getProjectPathOrThrow();
    const allowlist = options.allowlist ?? [];
    const skipDev = options.skipDev ?? false;
    const level = options.level ?? DEFAULT_VULNERABILITY_LEVEL;

    const levels = mapVulnerabilityLevelInput({ [level]: true });

    await npmAudit({
      directory: projectPath,
      'report-type': 'summary',
      allowlist,
      ...levels,
      'skip-dev': skipDev,
    });
  }
}
