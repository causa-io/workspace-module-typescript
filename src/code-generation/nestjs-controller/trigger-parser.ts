import type {
  EventTopicDefinition,
  GeneratedSchema,
  GeneratedSchemas,
} from '@causa/workspace-core';
import { resolve } from 'path';
import type { HttpTrigger, ServiceContainerTrigger } from './types.js';

/**
 * Lists the triggers calling an HTTP endpoint of the service, grouped by the base path of their endpoint.
 * Triggers that do not define an `http` endpoint are ignored. Triggers with an `http` endpoint but no path, or a path
 * with fewer than two segments, cause an error.
 *
 * @param triggers The `serviceContainer.triggers` configuration.
 * @param projectPath The absolute path to the project root, against which `dto` schema paths are resolved.
 * @param schemas The generated schemas used to type the event payloads, keyed by absolute schema path.
 * @param topics The event topic definitions in the workspace.
 * @returns The {@link HttpTrigger}s, indexed by the base path of their endpoint.
 */
export function listHttpTriggers(
  triggers: Record<string, ServiceContainerTrigger>,
  projectPath: string,
  schemas: GeneratedSchemas,
  topics: EventTopicDefinition[],
): Map<string, HttpTrigger[]> {
  const groups = new Map<string, HttpTrigger[]>();

  for (const [name, trigger] of Object.entries(triggers)) {
    const { endpoint } = trigger;
    if (
      typeof endpoint !== 'object' ||
      endpoint === null ||
      endpoint.type !== 'http'
    ) {
      continue;
    }

    const { path } = endpoint;
    if (typeof path !== 'string') {
      throw new Error(
        `Trigger '${name}' defines an HTTP endpoint without a 'path'.`,
      );
    }

    const segments = path.split('/').filter((s) => s.length > 0);
    if (segments.length < 2) {
      throw new Error(
        `The endpoint path '${path}' for trigger '${name}' must have at least two segments (the controller base path and the method sub-path).`,
      );
    }

    const basePath = segments.slice(0, -1).join('/');
    const subPath = segments.at(-1)!;
    const eventSchema = resolveTriggerEventSchema(
      name,
      trigger,
      projectPath,
      schemas,
      topics,
    );
    const httpTrigger: HttpTrigger = { name, trigger, subPath, eventSchema };

    const group = groups.get(basePath);
    if (group) {
      group.push(httpTrigger);
    } else {
      groups.set(basePath, [httpTrigger]);
    }
  }

  return groups;
}

/**
 * Resolves the generated class used to type the event payload of the given trigger.
 * For `event` triggers, this is the class generated for the topic's schema. For other triggers, this is the class
 * generated for the `dto` schema (resolved relative to the project root), when defined.
 *
 * @param name The name of the trigger.
 * @param trigger The trigger configuration.
 * @param projectPath The absolute path to the project root.
 * @param schemas The generated schemas, keyed by absolute schema path.
 * @param topics The event topic definitions in the workspace.
 * @returns The {@link GeneratedSchema} for the event payload, or `undefined` when the payload is untyped.
 */
function resolveTriggerEventSchema(
  name: string,
  { type, topic, dto }: ServiceContainerTrigger,
  projectPath: string,
  schemas: GeneratedSchemas,
  topics: EventTopicDefinition[],
): GeneratedSchema | undefined {
  if (type === 'event') {
    const definition = topics.find(({ id }) => id === topic);
    if (!definition) {
      throw new Error(
        `The definition for event topic '${topic}' referenced by trigger '${name}' could not be found.`,
      );
    }

    const schema = schemas[definition.schemaFilePath];
    if (!schema) {
      throw new Error(
        `No class was generated for the schema of event topic '${topic}' referenced by trigger '${name}'.`,
      );
    }

    return schema;
  }

  if (dto === undefined) {
    return undefined;
  }

  if (typeof dto !== 'string' || dto.length === 0) {
    throw new Error(
      `The 'dto' configuration for trigger '${name}' must be a non-empty string.`,
    );
  }

  const schema = schemas[resolve(projectPath, dto)];
  if (!schema) {
    throw new Error(
      `No class was generated for the DTO schema '${dto}' referenced by trigger '${name}'.`,
    );
  }

  return schema;
}
