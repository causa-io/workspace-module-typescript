import { ModuleRegistrationContext } from '@causa/workspace';
import { EventTopicGenerateCodeForTypeScriptAndJsonEvents } from './event-topic-generate-json.js';
import { ProjectReadVersionForJavascript } from './project-read-version-javascript.js';

export function registerFunctions(context: ModuleRegistrationContext) {
  context.registerFunctionImplementations(
    EventTopicGenerateCodeForTypeScriptAndJsonEvents,
    ProjectReadVersionForJavascript,
  );
}
