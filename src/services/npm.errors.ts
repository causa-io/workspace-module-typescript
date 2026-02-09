import { ProcessServiceExitCodeError } from '@causa/workspace-core/services';

/**
 * An error thrown when an npm process returns a non-zero exit code.
 */
export class NpmExitCodeError extends ProcessServiceExitCodeError {
  constructor(parentError: ProcessServiceExitCodeError) {
    super(parentError.command, parentError.args, parentError.result);

    this.message = `npm command '${this.args[0]}' exited with code ${this.result.code}.`;
  }
}

/**
 * An error thrown when the installed npm version is incompatible with the required version set in the configuration.
 */
export class IncompatibleNpmVersionError extends Error {
  constructor(
    readonly installedVersion: string,
    readonly requiredVersion: string,
  ) {
    super(
      `Installed npm version ${installedVersion} is incompatible with required version ${requiredVersion}.`,
    );
  }
}
