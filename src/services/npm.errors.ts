import { ProcessServiceExitCodeError } from '@causa/workspace-core';

/**
 * An error thrown when an npm process returns a non-zero exit code.
 */
export class NpmExitCodeError extends ProcessServiceExitCodeError {
  constructor(parentError: ProcessServiceExitCodeError) {
    super(parentError.command, parentError.args, parentError.result);

    this.message = `npm command '${this.args[0]}' exited with code ${this.result.code}.`;
  }
}
