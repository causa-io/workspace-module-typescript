import { ModuleRegistrationContext } from '@causa/workspace';
import { EventTopicGenerateCodeForTypeScriptAndJsonEvents } from './event-topic-generate-json.js';
import { ProjectBuildArtefactForTypeScriptPackage } from './project-build-artefact-ts-package.js';
import { ProjectGetArtefactDestinationForNpmPackage } from './project-get-artefact-destination-npm-package.js';
import { ProjectReadVersionForJavascript } from './project-read-version-javascript.js';

export function registerFunctions(context: ModuleRegistrationContext) {
  context.registerFunctionImplementations(
    EventTopicGenerateCodeForTypeScriptAndJsonEvents,
    ProjectBuildArtefactForTypeScriptPackage,
    ProjectGetArtefactDestinationForNpmPackage,
    ProjectReadVersionForJavascript,
  );
}
