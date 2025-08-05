import { type EventTopicDefinition } from '@causa/workspace-core';
import micromatch from 'micromatch';
import { resolve } from 'path';
import {
  ClassType,
  EnumType,
  panic,
  Type,
  type Sourcelike,
} from 'quicktype-core';
import {
  ObjectType,
  removeNullFromUnion,
  UnionType,
} from 'quicktype-core/dist/Type/index.js';
import {
  TypeScriptWithDecoratorsRenderer,
  type ClassContext,
} from '../renderer.js';
import type { TypeScriptTestExpectationOptions } from './options.js';

/**
 * The type of expectation to emit for a class.
 * If the expectation is for an event topic, its definition is included.
 */
type ExpectationToEmit =
  | ['entityEventTopic', EventTopicDefinition]
  | ['eventTopic', EventTopicDefinition]
  | ['entityMutation', null]
  | ['entity', null]
  | [null, null];

/**
 * A renderer that generates TypeScript utility functions for test expectations.
 */
export class TypeScriptTestExpectationRenderer extends TypeScriptWithDecoratorsRenderer<TypeScriptTestExpectationOptions> {
  decoratorsForClass(): [] {
    return [];
  }

  decoratorsForProperty(): [] {
    return [];
  }

  /**
   * Constructs the function name for a class type.
   *
   * @param classType The class type to generate a function name for.
   * @param options Options to customize the function name.
   * @returns The function name for the class type, e.g., `expectEntity`.
   */
  protected getFunctionNameForClassType(
    classType: ClassType,
    options: {
      /**
       * Prefix to add at the beginning the function name.
       */
      prefix?: string;

      /**
       * Suffix to add at the end of the function name.
       */
      suffix?: string;
    } = {},
  ): string {
    const className = this.nameForNamedType(classType);
    const classNameStr = this.names.get(className);
    if (!classNameStr) {
      panic(
        `Could not find name for class type '${classType.getCombinedName()}'.`,
      );
    }

    const [context] = this.contextForClassType(classType);

    const nameForFunction = context.constraintFor
      ? this.removeConstraintSuffix(classNameStr)
      : classNameStr;

    const prefix = options.prefix ?? 'expect';
    const suffix = options.suffix ?? '';
    return `${prefix}${nameForFunction}${suffix}`;
  }

  /**
   * Checks if the given class should generate an entity expectation based on the globs.
   *
   * @param uri The URI of the class.
   * @returns `true` if an entity expectation should be generated.
   */
  protected shouldGenerateEntityExpectation(uri: string | undefined): boolean {
    if (!uri) {
      return false;
    }

    const entitiesGlobs =
      this.targetLanguage.options.generatorOptions?.entitiesGlobs;
    if (!Array.isArray(entitiesGlobs)) {
      return true;
    }

    const projectPath =
      this.targetLanguage.workspaceContext.getProjectPathOrThrow();
    const absoluteGlobs = entitiesGlobs.map((g) => resolve(projectPath, g));

    const [uriPath] = uri.split('#', 1);
    return micromatch.isMatch(uriPath, absoluteGlobs);
  }

  /**
   * Emits the entity expectation function for a class type.
   *
   * @param classType The class type to emit the expectation for.
   * @param className The name of the class.
   */
  protected emitEntityExpectation(context: ClassContext): string[] {
    const { name: expectationTypeName, file: expectationTypeFile } =
      this.findModelClassSchema(context.classType);
    this.addImports({
      [expectationTypeFile]: context.constraintFor
        ? [`type ${expectationTypeName}`]
        : [expectationTypeName],
    });

    let entityTypeName = expectationTypeName;
    if (context.constraintFor) {
      const { name, file } = this.findModelClassSchema(context.constraintFor);
      entityTypeName = name;
      this.addImports({ [file]: [name] });
    }

    this.addImports({
      '@causa/runtime': [
        'type Transaction',
        'type TransactionRunner',
        'type ReadOnlyStateTransaction',
      ],
    });

    const existFunctionName = this.getFunctionNameForClassType(
      context.classType,
    );
    const functionNames = [existFunctionName];

    this.ensureBlankLine();
    this.emitLine(`export async function ${existFunctionName}(`);
    this.emitLine(
      `runner: TransactionRunner<Transaction, ReadOnlyStateTransaction>,`,
    );
    this.emitLine(`expected: Partial<${expectationTypeName}>,`);
    this.emitLine(`): Promise<${expectationTypeName}> {`);
    this.emitLine(
      `const actual = await runner.run((t) => t.get(${entityTypeName}, expected));`,
    );
    this.emitLine(`expect(actual).toEqual({`);
    this.emitPropertyMatchers(context);
    this.emitLine(`...expected,`);
    this.emitLine(`});`);
    this.emitLine(`return actual as ${expectationTypeName};`);
    this.emitLine(`}`);

    if (!context.constraintFor) {
      const notToExistFunctionName = this.getFunctionNameForClassType(
        context.classType,
        { suffix: 'NotToExist' },
      );
      functionNames.push(notToExistFunctionName);

      this.ensureBlankLine();
      this.emitLine(`export async function ${notToExistFunctionName}(`);
      this.emitLine(
        `runner: TransactionRunner<Transaction, ReadOnlyStateTransaction>,`,
      );
      this.emitLine(`key: Partial<${expectationTypeName}>,`);
      this.emitLine(`): Promise<void> {`);
      this.emitLine(
        `const actual = await runner.run((t) => t.get(${entityTypeName}, key));`,
      );
      this.emitLine(`expect(actual).toEqual(null);`);
      this.emitLine(`}`);
    }

    return functionNames;
  }

  /**
   * Emits property matchers for the expectation.
   *
   * @param context The class context.
   * @param filter Optional filter emit only certain properties.
   */
  protected emitPropertyMatchers(
    context: ClassContext,
    filter: (jsonName: string) => boolean = () => true,
  ): void {
    this.emitPropertiesWithHandler(
      context,
      ({ jsonName, property: { type, isOptional }, isConst }) =>
        filter(jsonName)
          ? this.getMatcherForType(type, { isOptional, isConst })
          : null,
    );
  }

  /**
   * Gets the Jest matcher expression for a given type.
   *
   * @param type The type to get a matcher for.
   * @returns The Jest matcher expression as a string.
   */
  protected getMatcherForType(
    type: Type,
    options: {
      /**
       * Whether the property is optional, and `undefined` is a valid value.
       */
      isOptional?: boolean;
      /**
       * Whether the property is a constant, and should expect the exact value.
       */
      isConst?: boolean;
    } = {},
  ): Sourcelike {
    this.addImports({ 'jest-extended': [] });

    if (type instanceof UnionType) {
      const [hasNull, nonNullTypes] = removeNullFromUnion(type);
      const matchers = [...nonNullTypes].map((t) => this.getMatcherForType(t));
      if (hasNull) {
        matchers.unshift('null');
      }
      if (options.isOptional) {
        matchers.unshift('undefined');
      }
      return ['expect.toBeOneOf([', ...matchers.flatMap((m) => [m, ',']), '])'];
    }

    if (type instanceof EnumType) {
      const cases = [...type.cases].map((c) => JSON.stringify(c));
      if (options.isOptional) {
        cases.unshift('undefined');
      }
      return `expect.toBeOneOf([${cases.join(', ')}])`;
    }

    if (options.isOptional) {
      return `expect.toBeOneOf([undefined, ${this.getMatcherForType(type)}])`;
    }

    switch (type.kind) {
      case 'class':
      case 'object':
        const [{ constraintFor }] = this.contextForClassType(type as ClassType);
        const { name, file } = this.findModelClassSchema(
          constraintFor ?? (type as ClassType),
        );
        this.addImports({ [file]: [name] });
        return `expect.any(${name})`;
      case 'array':
        return 'expect.any(Array)';
      case 'null':
        return 'null';
      case 'map':
        return 'expect.any(Object)';
      case 'string':
      case 'uuid':
        return 'expect.any(String)';
      case 'integer':
      case 'double':
        return 'expect.any(Number)';
      case 'bool':
        return 'expect.any(Boolean)';
      case 'date':
      case 'date-time':
        return 'expect.any(Date)';
      default:
        return 'expect.anything()';
    }
  }

  /**
   * Emits generic event expectations for a class type that matches an event topic.
   *
   * @param context The class context.
   * @param eventTopic The event topic definition.
   */
  protected emitGenericEventExpectations(
    context: ClassContext,
    eventTopic: EventTopicDefinition,
  ): string[] {
    const { name: eventClassName, file } = this.findModelClassSchema(
      context.classType,
    );
    this.addImports({ [file]: [eventClassName] });

    const expectEventFunctionName = this.getFunctionNameForClassType(
      context.classType,
    );
    const expectNoEventFunctionName = this.getFunctionNameForClassType(
      context.classType,
      { prefix: 'expectNo' },
    );

    this.addImports({ '@causa/runtime/nestjs/testing': ['type EventFixture'] });

    this.ensureBlankLine();
    this.emitLine(`export async function ${expectEventFunctionName}(`);
    this.emitLine(`eventFixture: EventFixture,`);
    this.emitLine(`expected: Partial<${eventClassName}> = {},`);
    this.emitLine(`): Promise<void> {`);
    this.emitLine(`await eventFixture.expectEvent('${eventTopic.id}', {`);
    this.emitPropertyMatchers(context);
    this.emitLine(`...expected,`);
    this.emitLine(`});`);
    this.emitLine(`}`);

    this.ensureBlankLine();
    this.emitLine(`export async function ${expectNoEventFunctionName}(`);
    this.emitLine(`eventFixture: EventFixture,`);
    this.emitLine(`): Promise<void> {`);
    this.emitLine(`await eventFixture.expectNoEvent('${eventTopic.id}');`);
    this.emitLine(`}`);

    return [expectEventFunctionName, expectNoEventFunctionName];
  }

  /**
   * Gets the data type for an event class, which is the type of the `data` property.

   * @param classType The event class type.
   * @param baseType Optional base type to use if the class type is a constraint.
   * @returns The data type of the event.
   */
  protected getEventDataType(
    classType: ClassType,
    baseType?: ClassType,
  ): ClassType {
    const dataType =
      classType.getProperties().get('data')?.type ??
      baseType?.getProperties().get('data')?.type;
    if (!(dataType instanceof ObjectType)) {
      panic(
        `Entity event class ${classType.getCombinedName()} must have a 'data' object property.`,
      );
    }

    return dataType;
  }

  /**
   * Emits the "entity not mutated" expectation for entity events.
   *
   * @param classType The event class type.
   * @param eventTopic The event topic definition.
   */
  protected emitEntityEventNotMutatedExpectation(
    classType: ClassType,
    eventTopic: EventTopicDefinition,
  ): string[] {
    const dataType = this.getEventDataType(classType);
    const { name: entityClassName, file } = this.findModelClassSchema(dataType);
    this.addImports({ [file]: [entityClassName] });

    const functionName = this.getFunctionNameForClassType(dataType, {
      suffix: 'NotMutated',
    });

    this.addImports({
      '@causa/runtime/testing': ['VersionedEntityFixture'],
      '@causa/runtime/nestjs/testing': ['type AppFixture'],
    });

    this.ensureBlankLine();
    this.emitLine(`export async function ${functionName}(`);
    this.emitLine(`fixture: AppFixture,`);
    this.emitLine(`entity: ${entityClassName},`);
    this.emitLine(`tests: { expectNoEvent?: boolean } = {},`);
    this.emitLine(`): Promise<void> {`);
    this.emitLine(
      `await fixture.get(VersionedEntityFixture).expectNoMutation(entity, {`,
    );
    this.emitLine(
      `expectNoEventInTopic: tests.expectNoEvent ? '${eventTopic.id}' : undefined,`,
    );
    this.emitLine(`});`);
    this.emitLine(`}`);

    return [functionName];
  }

  /**
   * Emits the entity mutated expectation for constraint types with `entityMutationFrom`.
   *
   * @param mutationEventType The constraint class type.
   */
  protected emitEntityMutatedExpectation(
    mutationTypeContext: ClassContext,
  ): string[] {
    const { classType: mutationEventType, constraintFor: baseEventType } =
      mutationTypeContext;
    if (!baseEventType) {
      panic(
        `Entity mutation ${mutationEventType.getCombinedName()} should constrain a parent event schema.`,
      );
    }

    const [{ uri }] = this.contextForClassType(baseEventType);
    const eventTopic = this.targetLanguage.options.eventTopics.find(
      (topic) => topic.schemaFilePath === uri,
    );
    if (!eventTopic) {
      panic(
        `Entity mutation ${mutationEventType.getCombinedName()} should constrain a parent event schema.`,
      );
    }

    const entityType = this.getEventDataType(baseEventType);
    const functionName = this.getFunctionNameForClassType(mutationEventType);
    const constrainedEntityType = this.getEventDataType(
      mutationEventType,
      baseEventType,
    );
    const { name: constrainedEntityName, file: constrainedEntityFile } =
      this.findModelClassSchema(constrainedEntityType);
    const [{ constraintFor: isConstrained }] = this.contextForClassType(
      constrainedEntityType,
    );
    const { name: entityName, file: entityFile } =
      this.findModelClassSchema(entityType);
    this.addImports({
      [constrainedEntityFile]: isConstrained
        ? [`type ${constrainedEntityName}`]
        : [constrainedEntityName],
      [entityFile]: [entityName],
    });

    const eventNameType =
      mutationEventType.getProperties().get('name')?.type ??
      baseEventType.getProperties().get('name')?.type;
    if (!(eventNameType instanceof EnumType)) {
      panic(
        `Entity mutation ${mutationEventType.getCombinedName()} or its parent event should have an enum or constant 'name' property.`,
      );
    }

    this.addImports({
      'jest-extended': [],
      '@causa/runtime': ['type EventAttributes'],
      '@causa/runtime/testing': ['VersionedEntityFixture'],
      '@causa/runtime/nestjs/testing': ['type AppFixture'],
    });

    const eventNameMatcher = `expect.toBeOneOf(${JSON.stringify([...eventNameType.cases])})`;

    this.ensureBlankLine();
    this.emitLine(`export async function ${functionName}(`);
    this.emitLine(`fixture: AppFixture,`);
    this.emitLine(`before: Partial<${entityName}>,`);
    this.emitLine(`updates: Partial<${constrainedEntityName}> = {},`);
    this.emitLine(`tests: {`);
    this.emitLine(`matchesHttpResponse?: object;`);
    this.emitLine(`eventAttributes?: EventAttributes;`);
    this.emitLine(`} = {},`);
    this.emitLine(`): Promise<${entityName}> {`);
    this.emitLine(
      `return await fixture.get(VersionedEntityFixture).expectMutated(`,
    );
    this.emitLine(`{ type: ${entityName}, entity: before },`);
    this.emitLine(`{`);
    this.emitLine(`expectedEntity: {`);
    this.emitExpectedEntityMatchers(
      constrainedEntityType,
      mutationTypeContext.objectAttributes.entityPropertyChanges,
    );
    this.emitLine(`},`);
    this.emitLine(`expectedEvent: {`);
    this.emitLine(`topic: '${eventTopic.id}',`);
    this.emitLine(`name: ${eventNameMatcher},`);
    this.emitLine(`attributes: tests.eventAttributes,`);
    this.emitLine(`},`);
    this.emitLine(`matchesHttpResponse: tests.matchesHttpResponse,`);
    this.emitLine(`},`);
    this.emitLine(`);`);
    this.emitLine(`}`);

    return [functionName];
  }

  /**
   * Emits the entity matchers for the given entity type, interleaved with `before` and `updates` arguments, depending
   * on the properties that can be expected to change in the entity.
   *
   * @param dataType The entity type.
   * @param entityPropertyChanges The properties that can be expected to change in the entity.
   */
  protected emitExpectedEntityMatchers(
    dataType: ClassType,
    entityPropertyChanges: string[] | '*' | undefined,
  ): void {
    const [dataTypeContext] = this.contextForClassType(dataType);
    const changes = entityPropertyChanges ?? [];

    if (changes === '*') {
      this.emitPropertyMatchers(dataTypeContext);
      this.emitLine('...updates,');
      return;
    }

    this.emitPropertyMatchers(
      dataTypeContext,
      (jsonName) => !changes.includes(jsonName),
    );
    this.emitLine('...before,');
    this.emitPropertyMatchers(dataTypeContext, (jsonName) =>
      changes.includes(jsonName),
    );
    this.emitLine('...updates,');
  }

  emitSourceStructure(): void {
    if (this.targetLanguage.options.leadingComment) {
      this.emitCommentLines(
        this.targetLanguage.options.leadingComment.split('\n'),
      );
      this.ensureBlankLine();
    }

    this.emitImportsPlaceholder();

    this.emitTypes();

    this.fillImportsPlaceholder();
  }

  /**
   * Returns the type of expectation that should be emitted for a class type.
   *
   * @param context The class context.
   * @returns The expectation to emit.
   */
  protected getExpectationForClass(context: ClassContext): ExpectationToEmit {
    const { uri, objectAttributes } = context;
    const eventTopic =
      this.targetLanguage.options.eventTopics.find(
        (t) => t.schemaFilePath === uri,
      ) ?? null;

    if (eventTopic) {
      return objectAttributes.entityEvent
        ? ['entityEventTopic', eventTopic]
        : ['eventTopic', eventTopic];
    }

    if (objectAttributes.entityMutationFrom) {
      return ['entityMutation', null];
    }

    if (this.shouldGenerateEntityExpectation(uri)) {
      return ['entity', null];
    }

    return [null, null];
  }

  protected emitClassBlock(classType: ClassType): void {
    const [context, causaAttribute] = this.contextForClassType(classType);
    const [expectation, eventTopic] = this.getExpectationForClass(context);
    if (!expectation) {
      return;
    }

    const functionNames: string[] = [];
    switch (expectation) {
      case 'entityEventTopic':
        functionNames.push(
          ...this.emitEntityEventNotMutatedExpectation(classType, eventTopic),
        );
      case 'eventTopic':
        functionNames.push(
          ...this.emitGenericEventExpectations(context, eventTopic),
        );
        break;
      case 'entityMutation':
        functionNames.push(...this.emitEntityMutatedExpectation(context));
        break;
      case 'entity':
        functionNames.push(...this.emitEntityExpectation(context));
        break;
    }

    if (functionNames.length > 0) {
      this.addGeneratedSchema(causaAttribute, functionNames.join(','));
    }
  }

  protected emitEnum(): void {}

  protected emitDescription(): void {}
}
