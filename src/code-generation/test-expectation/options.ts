import type {
  EventTopicDefinition,
  GeneratedSchemas,
} from '@causa/workspace-core';
import type { TypeScriptWithDecoratorsOptions } from '../renderer.js';

/**
 * Options for the `TypeScriptTestExpectation` language and renderer.
 */
export type TypeScriptTestExpectationOptions =
  TypeScriptWithDecoratorsOptions & {
    /**
     * The output of the model class generator, used to reference classes when instantiating test objects.
     */
    readonly modelClassSchemas: GeneratedSchemas;

    /**
     * The list of event topic definitions.
     */
    readonly eventTopics: EventTopicDefinition[];
  };
