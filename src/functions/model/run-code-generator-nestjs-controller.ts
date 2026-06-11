import {
  EventTopicList,
  ModelParseCodeGeneratorInputs,
  ModelRunCodeGenerator,
  type GeneratedSchemas,
  type PropertyType,
  type Schema,
  type ServiceContainerConfiguration,
} from '@causa/workspace-core';
import { loadSchemas } from '@causa/workspace-core/jsonschema';
import { camelCase, kebabCase, pascalCase } from 'change-case';
import { mkdir, readFile } from 'fs/promises';
import { basename, join } from 'path';
import { assignSchemaNames } from '../../code-generation/base.js';
import {
  listHttpTriggers,
  makeParametersSchemasForSpecification,
  parseOpenApiSpec,
  writeControllerFile,
  writeEventControllerFile,
  type EventControllerMethod,
  type HttpTrigger,
} from '../../code-generation/index.js';
import {
  makeCausaValidatorDecorators,
  makeClassValidatorDecorators,
  makePrimitiveTypeTransformerDecorators,
  TypeScriptModelClassGenerator,
  type ModelClassSchemaDecorators,
} from '../../code-generation/model-class/index.js';
import type { TypeScriptModelConfiguration } from '../../configurations/index.js';
import { ModelGenerateTypeScriptTriggerDecorators } from '../../definitions/index.js';
import { TYPESCRIPT_MODEL_CLASS_GENERATOR } from './run-code-generator-model-class.js';
import {
  requirePreviousGeneratorOutput,
  resolveOutputPath,
  throwOnSchemaErrors,
} from './utils.js';

/**
 * The name of the generator for {@link ModelRunCodeGeneratorForTypeScriptNestjsController}.
 */
export const TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR =
  'typescriptNestjsController';

/**
 * The implementation of {@link ModelRunCodeGenerator} for the TypeScript NestJS controller generator.
 *
 * This generator:
 * 1. Parses OpenAPI YAML specification files.
 * 2. Extracts path and query parameters and builds {@link Schema}s for them.
 * 3. Lists the `serviceContainer.triggers` calling an HTTP endpoint of the service.
 * 4. Loads any external JSON Schema files referenced by parameter `$ref`s (following transitive refs) so the merged
 *    schema set carries enough information to render the parameter classes.
 * 5. Feeds those schemas through {@link TypeScriptModelClassGenerator} to produce `model.ts`. Schemas already emitted
 *    by the preceding `typescriptModelClass` generator are imported from its output file rather than re-emitted;
 *    transitive dependencies that were not previously emitted are written into `model.ts` alongside the parameter
 *    classes.
 * 6. Generates `*.api.controller.ts` files with TypeScript interfaces and decorator factories.
 * 7. Generates `*.events.controller.ts` files for HTTP triggers, grouped by endpoint base path, with methods decorated
 *    using {@link ModelGenerateTypeScriptTriggerDecorators} implementations and typed using event topic schemas or
 *    trigger DTOs.
 */
export class ModelRunCodeGeneratorForTypeScriptNestjsController extends ModelRunCodeGenerator {
  async _call(): Promise<GeneratedSchemas> {
    const { configuration } = this;

    const outputDir = resolveOutputPath(
      this._context,
      TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR,
      configuration.output,
      'directory path',
    );
    const modelFilePath = join(outputDir, 'model.ts');

    const modelClassSchemas = requirePreviousGeneratorOutput(
      this.previousGeneratorsOutput,
      TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR,
      TYPESCRIPT_MODEL_CLASS_GENERATOR,
    );

    const { files } = await this._context.call(ModelParseCodeGeneratorInputs, {
      configuration,
    });
    this._context.logger.debug(
      `Found ${files.length} OpenAPI specification file(s) to process.`,
    );

    const parsedSpecs = await Promise.all(files.map(parseOpenApiSpec));
    const specs = parsedSpecs.filter((spec) => spec.operations.length > 0);

    const triggers =
      this._context
        .asConfiguration<ServiceContainerConfiguration>()
        .get('serviceContainer.triggers', { unsafe: true }) ?? {};
    const topics = await this._context.call(EventTopicList, {});
    const triggerGroups = listHttpTriggers(
      triggers,
      this._context.getProjectPathOrThrow(),
      modelClassSchemas,
      topics,
    );

    if (specs.length === 0 && triggerGroups.size === 0) {
      this._context.logger.warn(
        `No OpenAPI operations nor HTTP triggers found for generator '${TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR}'.`,
      );
      return {};
    }

    await mkdir(outputDir, { recursive: true });

    const parameterSchemas = specs.reduce(
      (acc, spec) =>
        Object.assign(acc, makeParametersSchemasForSpecification(spec)),
      {} as Record<string, Schema>,
    );
    const externalSchemas = await this.loadExternalRefSchemas(parameterSchemas);
    const generatedParameterSchemas = await this.generateParameterSchemas(
      { ...externalSchemas, ...parameterSchemas },
      modelFilePath,
      modelClassSchemas,
    );

    for (const spec of specs) {
      const controllerFileName = basename(spec.filePath)
        .replace(/\.\w+$/, '')
        .concat('.controller.ts');
      const controllerFilePath = join(outputDir, controllerFileName);

      await writeControllerFile(
        spec,
        modelClassSchemas,
        generatedParameterSchemas,
        controllerFilePath,
      );

      this._context.logger.debug(`Generated '${controllerFileName}'.`);
    }

    await this.generateEventControllers(triggerGroups, outputDir);

    return generatedParameterSchemas;
  }

  _supports(): boolean {
    return (
      this._context.get('project.language') === 'typescript' &&
      this.generator === TYPESCRIPT_NESTJS_CONTROLLER_GENERATOR
    );
  }

  /**
   * Generates TypeScript classes for parameter schemas (and any external schemas they reference) using
   * {@link TypeScriptModelClassGenerator}. The synthetic schema paths (`${operationId}/${location}`) flow through to
   * the {@link GeneratedSchemas} the controller renderer relies on. Decorator computation is skipped for paths in
   * `existingSchemas` since those classes are imported, not emitted.
   *
   * @param rawSchemas The parameter schemas plus any external schemas reachable from their `$ref`s.
   * @param modelFilePath The file path to generate the classes at.
   * @param existingSchemas Schemas already emitted by a previous generator that should be imported instead of
   *   re-emitted. Passed straight to {@link TypeScriptModelClassGenerator}.
   * @returns The generated schemas, keyed by the synthetic parameter schema paths.
   */
  private async generateParameterSchemas(
    rawSchemas: Record<string, Schema>,
    modelFilePath: string,
    existingSchemas: GeneratedSchemas,
  ): Promise<GeneratedSchemas> {
    if (Object.keys(rawSchemas).length === 0) {
      return {};
    }

    const constraintSuffix = this._context
      .asConfiguration<TypeScriptModelConfiguration>()
      .get('model.constraintSuffix');
    const schemas = assignSchemaNames(rawSchemas, {
      constraintSuffix,
      existingSchemas,
    });

    const decorators: Record<string, ModelClassSchemaDecorators> = {};
    for (const schema of Object.values(schemas)) {
      if (schema.kind !== 'object' || existingSchemas[schema.path]) {
        continue;
      }

      decorators[schema.path] = {
        class: [
          ...makeCausaValidatorDecorators(schema, undefined),
          ...makeClassValidatorDecorators(schema, undefined, schemas),
          ...makePrimitiveTypeTransformerDecorators(schema, undefined),
        ],
        properties: Object.fromEntries(
          schema.properties.map((property) => {
            const decorators = [
              ...makeCausaValidatorDecorators(schema, property),
              ...makeClassValidatorDecorators(schema, property, schemas),
              ...makePrimitiveTypeTransformerDecorators(schema, property),
            ];
            return [property.name, decorators];
          }),
        ),
      };
    }

    const generator = new TypeScriptModelClassGenerator(
      modelFilePath,
      schemas,
      { decorators, existingSchemas, constraintSuffix },
    );
    await generator.generate();

    return generator.generatedSchemas;
  }

  /**
   * Loads any external JSON Schema files referenced from the given parameter schemas using {@link loadSchemas},
   * following transitive `$ref`s. The returned map covers every dependency reachable from the parameters and is
   * suitable for merging into the schema set passed to {@link TypeScriptModelClassGenerator}.
   *
   * @param parameterSchemas The parameter schemas to inspect for external refs.
   * @returns The external schemas, indexed by their absolute source path.
   */
  private async loadExternalRefSchemas(
    parameterSchemas: Record<string, Schema>,
  ): Promise<Record<string, Schema>> {
    const files = new Set<string>();
    for (const schema of Object.values(parameterSchemas)) {
      if (schema.kind !== 'object') {
        continue;
      }

      for (const property of schema.properties) {
        collectRefFiles(property.type, files, parameterSchemas);
      }
    }
    if (files.size === 0) {
      return {};
    }

    const { schemas, errors } = await loadSchemas([...files], {
      fileReader: (path) => readFile(path, { encoding: 'utf-8' }),
    });
    throwOnSchemaErrors(
      errors,
      'Failed to load one or more schema files referenced from OpenAPI parameters:',
    );
    return schemas;
  }

  /**
   * Generates one event controller file per group of HTTP triggers sharing the same endpoint base path.
   * Each trigger becomes a method, with additional decorators collected by dispatching
   * {@link ModelGenerateTypeScriptTriggerDecorators} via `callAll`.
   *
   * @param groups The HTTP triggers to generate controllers for, indexed by the base path of their endpoint.
   * @param outputDir The directory controller files are written to.
   */
  private async generateEventControllers(
    groups: Map<string, HttpTrigger[]>,
    outputDir: string,
  ): Promise<void> {
    for (const [basePath, triggers] of groups) {
      const methods: EventControllerMethod[] = [];
      for (const { name: rawName, trigger, subPath, eventSchema } of triggers) {
        const name = camelCase(rawName);
        if (methods.some((m) => m.name === name)) {
          throw new Error(
            `Duplicate method name '${name}' in the event controller for path '${basePath}'.`,
          );
        }

        const description =
          typeof trigger.description === 'string'
            ? trigger.description
            : undefined;

        const decorators = (
          await Promise.all(
            this._context.callAll(ModelGenerateTypeScriptTriggerDecorators, {
              generator: this.generator,
              configuration: this.configuration,
              name: name,
              trigger,
            }),
          )
        ).flat();

        methods.push({ name, subPath, description, eventSchema, decorators });
      }

      const name = pascalCase(basePath);
      const controllerFileName = `${kebabCase(basePath)}.events.controller.ts`;
      const controllerFilePath = join(outputDir, controllerFileName);
      await writeEventControllerFile(
        { name, basePath, methods },
        controllerFilePath,
      );

      this._context.logger.debug(`Generated '${controllerFileName}'.`);
    }
  }
}

/**
 * Collects the absolute file path of every `$ref` reachable from the given property type into {@link out}, stripping
 * the JSON-Pointer fragment so the path can be fed to {@link loadSchemas}. Refs already present in {@link known} (such
 * as inline enums materialized into the parameter schema map) are skipped so they aren't loaded externally.
 */
function collectRefFiles(
  type: PropertyType,
  out: Set<string>,
  known: Record<string, Schema>,
): void {
  switch (type.kind) {
    case 'ref':
      if (!known[type.ref]) {
        out.add(type.ref.split('#')[0]);
      }
      return;
    case 'array':
      collectRefFiles(type.items, out, known);
      return;
    case 'map':
      if (type.items !== 'any') {
        collectRefFiles(type.items, out, known);
      }
      return;
    default:
      return;
  }
}
