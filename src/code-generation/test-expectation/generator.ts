import type {
  ConstPropertyType,
  EnumSchema,
  EventTopicDefinition,
  GeneratedSchemas,
  ObjectSchema,
  Property,
  PropertyType,
  RefPropertyType,
  Schema,
} from '@causa/workspace-core';
import micromatch from 'micromatch';
import {
  BaseTypeScriptCodeGenerator,
  enumCaseNames,
  findEnumCaseName,
  findModelClass,
  getConstraintBaseObject,
  getConstraintBasePath,
  propertyKey,
  resolveEnumForObjectProperty,
} from '../base.js';

/**
 * Options for {@link TypeScriptTestExpectationGenerator}.
 */
export type TypeScriptTestExpectationGeneratorOptions = Partial<
  Pick<TypeScriptTestExpectationGenerator, 'entitiesGlobs'>
>;

/**
 * Generates TypeScript test expectation helper functions (`expect*`, `expectNo*`, `expect*NotMutated`,
 * `expect*NotToExist`) for the given {@link Schema}s and writes the formatted output to disk.
 *
 * The expectation kind for each object schema is decided as follows:
 * 1. If the schema's path matches an event topic, emit generic event expectations (`expect<X>`, `expectNo<X>`). If
 *    the schema also has the `entityEvent` extension, additionally emit `expect<EntityName>NotMutated`.
 * 2. Otherwise, if the schema has the `entityMutationFrom` extension (a mutation constraint), emit
 *    `expect<MutationName>` which exercises `VersionedEntityFixture.expectMutated`.
 * 3. Otherwise, if the schema's path matches `entitiesGlobs`, emit `expect<EntityName>` and (for non-constraint
 *    schemas) `expect<EntityName>NotToExist`.
 */
export class TypeScriptTestExpectationGenerator extends BaseTypeScriptCodeGenerator {
  /**
   * Absolute globs describing which schemas should generate entity expectations. When omitted, every schema not
   * matching a more specific case generates entity expectations.
   */
  readonly entitiesGlobs?: string[];

  /**
   * Creates a new generator.
   *
   * @param outputPath Absolute path of the file the rendered source will be written to.
   * @param schemas The schemas to introspect, indexed by their absolute source path. Should include every schema the
   *   emitted helpers can reach (objects to emit + every enum / union / object referenced from their properties).
   * @param modelClassSchemas The output of the model-class generator, used to look up class / enum names and import
   *   targets.
   * @param eventTopics Event topic definitions used to decide when to emit event-shaped expectations.
   * @param options Options.
   */
  constructor(
    outputPath: string,
    readonly schemas: Record<string, Schema>,
    readonly modelClassSchemas: GeneratedSchemas,
    readonly eventTopics: EventTopicDefinition[],
    readonly options: TypeScriptTestExpectationGeneratorOptions = {},
  ) {
    super(outputPath);
    this.entitiesGlobs = options.entitiesGlobs;
  }

  /**
   * Renders every eligible schema, formats the output with prettier, and writes it to {@link outputPath}.
   * Populates {@link generatedSchemas}. Returns silently when nothing matches.
   */
  async generate(): Promise<void> {
    const blocks: string[] = [];

    const sortedSchemas = Object.values(this.schemas).toSorted((a, b) =>
      a.path.localeCompare(b.path),
    );
    for (const schema of sortedSchemas) {
      if (schema.kind !== 'object') {
        continue;
      }

      const names = this.emitExpectation(schema, blocks);
      if (names.length > 0) {
        this.generatedSchemas[schema.path] = {
          name: names.join(','),
          file: this.outputPath,
        };
      }
    }

    await this.renderFile(blocks.join('\n\n'));
  }

  /**
   * Emits the relevant function block(s) for the given schema, appending the source to `blocks` and returning the
   * list of emitted function names. Picks the expectation kind from the schema (event topic match → entity event /
   * generic event; `entityMutationFrom` extension → entity mutation; matching `entitiesGlobs` → entity).
   */
  private emitExpectation(schema: ObjectSchema, blocks: string[]): string[] {
    const eventTopic = this.eventTopics.find(
      (t) => t.schemaFilePath === schema.path,
    );
    if (eventTopic) {
      const eventNames = this.emitGenericEventExpectations(
        schema,
        eventTopic,
        blocks,
      );
      if (!schema.extensions.entityEvent) {
        return eventNames;
      }

      const notMutatedNames = this.emitEntityEventNotMutated(
        schema,
        eventTopic,
        blocks,
      );
      return [...notMutatedNames, ...eventNames];
    }

    if (schema.extensions.entityMutationFrom) {
      return this.emitEntityMutated(schema, blocks);
    }

    if (
      !this.entitiesGlobs ||
      micromatch.isMatch(schema.path.split('#')[0], this.entitiesGlobs)
    ) {
      return this.emitEntityExpectation(schema, blocks);
    }

    return [];
  }

  /**
   * Emits `expect<X>` and (when not a constraint) `expect<X>NotToExist`.
   */
  private emitEntityExpectation(
    schema: ObjectSchema,
    blocks: string[],
  ): string[] {
    const constraintForPath = getConstraintBasePath(schema);
    const isConstraint = constraintForPath !== undefined;
    const expectationModelClass = findModelClass(
      this.modelClassSchemas,
      schema.path,
    );
    this.addImports({
      [expectationModelClass.file]: [
        isConstraint
          ? `type ${expectationModelClass.name}`
          : expectationModelClass.name,
      ],
    });

    let entityClassName = expectationModelClass.name;
    if (constraintForPath !== undefined) {
      const base = findModelClass(this.modelClassSchemas, constraintForPath);
      entityClassName = base.name;
      this.addImports({ [base.file]: [base.name] });
    }

    this.addImports({
      '@causa/runtime': [
        'type Transaction',
        'type TransactionRunner',
        'type ReadOnlyStateTransaction',
      ],
    });

    const existFunctionName = `expect${this.functionBaseName(schema)}`;
    blocks.push(`export async function ${existFunctionName}(
  runner: TransactionRunner<Transaction, ReadOnlyStateTransaction>,
  expected: Partial<${expectationModelClass.name}>,
): Promise<${expectationModelClass.name}> {
  const actual = await runner.run({ readOnly: true }, (t) => t.get(${entityClassName}, expected));
  expect(actual).toEqual({
    ${this.emitPropertyMatchers(schema)}
    ...expected,
  });
  return actual as ${expectationModelClass.name};
}`);

    const names = [existFunctionName];

    if (!isConstraint) {
      const notExistName = `${existFunctionName}NotToExist`;
      blocks.push(`export async function ${notExistName}(
  runner: TransactionRunner<Transaction, ReadOnlyStateTransaction>,
  key: Partial<${expectationModelClass.name}>,
): Promise<void> {
  const actual = await runner.run({ readOnly: true }, (t) => t.get(${entityClassName}, key));
  expect(actual).toEqual(null);
}`);
      names.push(notExistName);
    }

    return names;
  }

  /**
   * Emits the `expect<X>` + `expectNo<X>` event helpers for an event-topic-matching schema.
   */
  private emitGenericEventExpectations(
    schema: ObjectSchema,
    eventTopic: EventTopicDefinition,
    blocks: string[],
  ): string[] {
    const eventClass = findModelClass(this.modelClassSchemas, schema.path);
    this.addImports({ [eventClass.file]: [eventClass.name] });
    this.addImports({
      '@causa/runtime/nestjs/testing': ['type EventFixture'],
    });

    const expectName = `expect${this.functionBaseName(schema)}`;
    const expectNoName = `expectNo${this.functionBaseName(schema)}`;

    blocks.push(`export async function ${expectName}(
  eventFixture: EventFixture,
  expected: Partial<${eventClass.name}> = {},
): Promise<void> {
  await eventFixture.expectEvent(${JSON.stringify(eventTopic.id)}, {
    ${this.emitPropertyMatchers(schema)}
    ...expected,
  });
}`);
    blocks.push(`export async function ${expectNoName}(
  eventFixture: EventFixture,
): Promise<void> {
  await eventFixture.expectNoEvent(${JSON.stringify(eventTopic.id)});
}`);

    return [expectName, expectNoName];
  }

  /**
   * Emits `expect<EntityName>NotMutated` for an entity event topic schema.
   */
  private emitEntityEventNotMutated(
    schema: ObjectSchema,
    eventTopic: EventTopicDefinition,
    blocks: string[],
  ): string[] {
    const [dataObject] = this.eventDataObjects(schema);
    const entityClass = findModelClass(this.modelClassSchemas, dataObject.path);
    this.addImports({ [entityClass.file]: [entityClass.name] });
    this.addImports({
      '@causa/runtime/testing': ['VersionedEntityFixture'],
      '@causa/runtime/nestjs/testing': ['type AppFixture'],
    });

    const functionName = `expect${this.functionBaseName(dataObject)}NotMutated`;
    blocks.push(`export async function ${functionName}(
  fixture: AppFixture,
  entity: ${entityClass.name},
  tests: { expectNoEvent?: boolean } = {},
): Promise<void> {
  await fixture.get(VersionedEntityFixture).expectNoMutation(entity, {
    expectNoEventInTopic: tests.expectNoEvent ? ${JSON.stringify(eventTopic.id)} : undefined,
  });
}`);

    return [functionName];
  }

  /**
   * Emits `expect<MutationName>` for a mutation constraint schema (one with `entityMutationFrom` extension).
   */
  private emitEntityMutated(schema: ObjectSchema, blocks: string[]): string[] {
    const baseEventPath = getConstraintBasePath(schema);
    if (baseEventPath === undefined) {
      throw new Error(
        `Entity mutation '${schema.name}' must constrain a parent event schema.`,
      );
    }

    const baseEvent = this.schemas[baseEventPath];
    if (baseEvent?.kind !== 'object') {
      throw new Error(
        `Entity mutation '${schema.name}' constrains '${baseEventPath}' which is not an object schema.`,
      );
    }

    const eventTopic = this.eventTopics.find(
      (t) => t.schemaFilePath === baseEvent.path,
    );
    if (!eventTopic) {
      throw new Error(
        `Entity mutation '${schema.name}' constrains a schema that is not an event topic.`,
      );
    }

    const [entityObject] = this.eventDataObjects(baseEvent);
    const entityClass = findModelClass(
      this.modelClassSchemas,
      entityObject.path,
    );
    this.addImports({ [entityClass.file]: [entityClass.name] });

    const variants = this.eventDataObjects(schema, baseEvent);
    const variantClasses = variants.map((v) => {
      const isConstraint = getConstraintBasePath(v) !== undefined;
      const variantClass = findModelClass(this.modelClassSchemas, v.path);
      this.addImports({
        [variantClass.file]: [
          isConstraint ? `type ${variantClass.name}` : variantClass.name,
        ],
      });
      return variantClass;
    });

    const eventNameProperty =
      schema.properties.find((p) => p.name === 'name') ??
      baseEvent.properties.find((p) => p.name === 'name');
    if (!eventNameProperty) {
      throw new Error(
        `Entity mutation '${schema.name}' or its parent must declare an event 'name' property.`,
      );
    }
    let eventNames: readonly unknown[] = [];
    if (eventNameProperty.type.kind === 'const') {
      eventNames = [eventNameProperty.type.value];
    } else if (eventNameProperty.type.kind === 'ref') {
      const target = this.schemas[eventNameProperty.type.ref];
      if (target?.kind === 'enum') {
        eventNames = target.values;
      }
    }
    if (eventNames.length === 0) {
      throw new Error(
        `Entity mutation '${schema.name}' has no event names to match.`,
      );
    }

    this.addImports({
      'jest-extended': [],
      '@causa/runtime': ['type EventAttributes'],
      '@causa/runtime/testing': ['VersionedEntityFixture'],
      '@causa/runtime/nestjs/testing': ['type AppFixture'],
    });

    const functionName = `expect${this.functionBaseName(schema)}`;
    const eventNameMatcher = `expect.toBeOneOf(${JSON.stringify(eventNames)})`;
    const entityMatchers = this.emitExpectedEntityMatchers(
      variants,
      schema.extensions.entityPropertyChanges,
    );

    blocks.push(`export async function ${functionName}(
  fixture: AppFixture,
  before: Partial<${entityClass.name}>,
  updates: Partial<${variantClasses.map((c) => c.name).join(' | ')}> = {},
  tests: {
    matchesHttpResponse?: object;
    eventAttributes?: EventAttributes;
  } = {},
): Promise<${entityClass.name}> {
  return await fixture.get(VersionedEntityFixture).expectMutated(
    { type: ${entityClass.name}, entity: before },
    {
      expectedEntity: ${entityMatchers},
      expectedEvent: {
        topic: ${JSON.stringify(eventTopic.id)},
        name: ${eventNameMatcher},
        attributes: tests.eventAttributes,
      },
      matchesHttpResponse: tests.matchesHttpResponse,
    },
  );
}`);

    return [functionName];
  }

  /**
   * Returns the source for the `expectedEntity` value of an entity mutation expectation. For a single variant the
   * returned source is a `{ ... }` object literal interleaving `before` and `updates` spreads with the property
   * matchers as dictated by `entityPropertyChanges`. For multiple variants (when the `data` property is a `oneOf` of
   * constraint refs) the source is an `expect.toBeOneOf([ { ... }, ... ])` matcher, one object per variant.
   */
  private emitExpectedEntityMatchers(
    variants: ObjectSchema[],
    changes: string[] | '*' | undefined,
  ): string {
    const buildBody = (variant: ObjectSchema): string => {
      if (changes === '*') {
        return `{ ${this.emitPropertyMatchers(variant)}\n...updates }`;
      }

      const set = new Set(changes ?? []);
      return `{
${this.emitPropertyMatchers(variant, (n) => !set.has(n))}
...before,
${this.emitPropertyMatchers(variant, (n) => set.has(n))}
...updates
}`;
    };

    if (variants.length === 1) {
      return buildBody(variants[0]);
    }

    return `expect.toBeOneOf([
      ${variants.map((v) => buildBody(v)).join(',\n')}
    ])`;
  }

  /**
   * Returns the object schemas reached by the `data` property of the given event object schema, falling back to the
   * `baseSchema`'s `data` property when the constraint omits it. Always returns at least one variant. When the `data`
   * property is a single ref the array has one element; when it is a union (directly or by reference) every member
   * must resolve to an object schema and is included in the returned array.
   */
  private eventDataObjects(
    schema: ObjectSchema,
    baseSchema?: ObjectSchema,
  ): ObjectSchema[] {
    const dataProperty =
      schema.properties.find((p) => p.name === 'data') ??
      baseSchema?.properties.find((p) => p.name === 'data');
    if (!dataProperty) {
      throw new Error(
        `Entity event '${schema.name}' must have a 'data' object property.`,
      );
    }

    if (dataProperty.type.kind !== 'ref') {
      throw new Error(
        `Entity event '${schema.name}' must have a 'data' object property.`,
      );
    }
    const refTarget = this.schemas[dataProperty.type.ref];
    const memberTypes: PropertyType[] =
      refTarget?.kind === 'union' ? refTarget.types : [dataProperty.type];

    const variants: ObjectSchema[] = [];
    for (const member of memberTypes) {
      if (member.kind !== 'ref') {
        throw new Error(
          `Entity event '${schema.name}' 'data' property must reference an object schema.`,
        );
      }
      const target = this.schemas[member.ref];
      if (target?.kind !== 'object') {
        throw new Error(
          `Entity event '${schema.name}' 'data' property must reference an object schema.`,
        );
      }
      variants.push(target);
    }
    return variants;
  }

  /**
   * Returns the property matcher lines for a given object schema. Constraint own-properties are emitted first
   * (alphabetically), then any extra base properties (also alphabetically).
   *
   * @param schema The object schema to introspect.
   * @param filter Optional predicate; properties for which it returns `false` are skipped.
   */
  private emitPropertyMatchers(
    schema: ObjectSchema,
    filter: (name: string) => boolean = () => true,
  ): string {
    const baseObject = getConstraintBaseObject(schema, this.schemas);
    const matcherFor = (p: Property): string =>
      this.matcherForType(
        p.type,
        p,
        resolveEnumForObjectProperty(schema, p.name, this.schemas),
      );

    const own = schema.properties
      .filter((p) => filter(p.name))
      .map((p) => [p.name, matcherFor(p)])
      .sort(([a], [b]) => a.localeCompare(b));

    const ownNames = new Set(schema.properties.map((p) => p.name));
    const baseExtras =
      baseObject?.properties
        .filter((p) => !ownNames.has(p.name) && filter(p.name))
        .map((p) => [p.name, matcherFor(p)])
        .sort(([a], [b]) => a.localeCompare(b)) ?? [];

    return [...own, ...baseExtras]
      .map(([name, matcher]) => `${propertyKey(name)}: ${matcher},`)
      .join('\n');
  }

  /**
   * Returns the Jest matcher source for a given property type, with optional `null` / `undefined` allowed.
   */
  private matcherForType(
    type: PropertyType,
    options: { nullable?: boolean; required?: boolean } = {},
    enumContext?: EnumSchema,
  ): string {
    this.addImports({ 'jest-extended': [] });

    const items: string[] = [];
    if (options.required === false) {
      items.push('undefined');
    }
    if (options.nullable) {
      items.push('null');
    }

    const kind = type.kind !== 'primitive' ? type.kind : type.type;
    switch (kind) {
      case 'null': {
        if (!items.includes('null')) {
          items.push('null');
        }
        break;
      }
      case 'const': {
        const value = (type as ConstPropertyType).value;
        const caseName = enumContext
          ? findEnumCaseName(enumContext, value)
          : undefined;
        if (enumContext && caseName) {
          const modelClass = findModelClass(
            this.modelClassSchemas,
            enumContext.path,
          );
          this.addImports({ [modelClass.file]: [modelClass.name] });
          items.push(`${modelClass.name}.${caseName}`);
        } else {
          items.push(JSON.stringify(value));
        }
        break;
      }
      case 'ref': {
        const target = this.schemas[(type as RefPropertyType).ref];
        if (!target) {
          return 'expect.anything()';
        }

        if (target.kind === 'enum') {
          const modelClass = findModelClass(
            this.modelClassSchemas,
            target.path,
          );
          this.addImports({ [modelClass.file]: [modelClass.name] });
          items.push(
            ...enumCaseNames(target).map((c) => `${modelClass.name}.${c}`),
          );
        } else if (target.kind === 'union') {
          items.push(...target.types.map((t) => this.matcherForType(t)));
        } else {
          const resolvedTarget =
            getConstraintBaseObject(target, this.schemas) ?? target;
          const modelClass = findModelClass(
            this.modelClassSchemas,
            resolvedTarget.path,
          );
          this.addImports({ [modelClass.file]: [modelClass.name] });
          items.push(`expect.any(${modelClass.name})`);
        }
        break;
      }
      case 'array': {
        items.push('expect.any(Array)');
        break;
      }
      case 'map': {
        items.push('expect.any(Object)');
        break;
      }
      case 'string':
      case 'uuid': {
        items.push('expect.any(String)');
        break;
      }
      case 'integer':
      case 'number': {
        items.push('expect.any(Number)');
        break;
      }
      case 'boolean': {
        items.push('expect.any(Boolean)');
        break;
      }
      case 'datetime': {
        items.push('expect.any(Date)');
        break;
      }
    }

    return items.length === 1
      ? items[0]
      : `expect.toBeOneOf([${items.join(', ')}])`;
  }

  /**
   * Returns the base name used to build expectation function names (e.g. `expect<X>`). Mirrors the corresponding
   * model-class output name, so a `FooConstraint` schema (whose model-class output is the alias `Foo`) becomes
   * `expectFoo`.
   */
  private functionBaseName(schema: ObjectSchema): string {
    return findModelClass(this.modelClassSchemas, schema.path).name;
  }
}
