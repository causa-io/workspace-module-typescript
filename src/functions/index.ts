import { ModuleRegistrationContext } from '@causa/workspace';
import { ProjectReadVersionForJavascript } from './project-read-version-javascript.js';

export function registerFunctions(context: ModuleRegistrationContext) {
  context.registerFunctionImplementations(ProjectReadVersionForJavascript);
}
