import type { WorkspaceContext } from '@causa/workspace';
import type {
  EventTopicDefinition,
  GeneratedSchemas,
} from '@causa/workspace-core';
import { createContext } from '@causa/workspace/testing';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { expectToMatchRegexParts, generateFromSchema } from '../utils.test.js';
import { TypeScriptTestExpectationTargetLanguage } from './language.js';

describe('TypeScriptTestExpectationTargetLanguage', () => {
  let tmpDir: string;
  let outputFile: string;
  let projectPath: string;
  let context: WorkspaceContext;
  let schemaUri: string;
  const generatorOptions = { entitiesGlobs: ['./test.json'] };

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'causa-test-'));
    projectPath = tmpDir;
    outputFile = join(tmpDir, 'test-output.ts');
    schemaUri = join(tmpDir, 'test.json');
    ({ context } = createContext({ projectPath }));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should generate entity expectation functions', async () => {
    const schema = {
      type: 'object',
      title: 'MyEntity',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        age: { type: 'integer' },
        active: { type: 'boolean' },
        tags: { type: 'array', items: { type: 'string' } },
        metadata: { type: 'object' },
        createdAt: { type: 'string', format: 'date-time' },
        status: { $ref: '#/definitions/Status' },
        constantStatus: { const: '🪨' },
        nullableField: { type: ['string', 'null'] },
        optionalString: { type: 'string' },
        optionalNullable: { oneOf: [{ type: 'integer' }, { type: 'null' }] },
        optionalEnum: { $ref: '#/definitions/Status' },
      },
      required: [
        'id',
        'name',
        'age',
        'active',
        'tags',
        'metadata',
        'createdAt',
        'status',
        'constantStatus',
        'nullableField',
      ],
      definitions: {
        Status: {
          type: 'string',
          enum: ['active', 'inactive', 'pending'],
        },
      },
    };
    const modelClassSchemas: GeneratedSchemas = {
      [schemaUri]: {
        file: join(tmpDir, 'models/entity.ts'),
        name: 'MyEntity',
      },
      [`${schemaUri}#/definitions/Status`]: {
        file: join(tmpDir, 'models/entity.ts'),
        name: 'CustomStatus',
      },
    };
    const eventTopics: EventTopicDefinition[] = [];
    const language = new TypeScriptTestExpectationTargetLanguage(
      outputFile,
      context,
      { modelClassSchemas, eventTopics, generatorOptions },
    );

    const generatedCode = await generateFromSchema(
      language,
      schema,
      outputFile,
      schemaUri,
    );

    expectToMatchRegexParts(generatedCode, [
      'import \\{',
      'type ReadOnlyStateTransaction,',
      'type Transaction,',
      'type TransactionRunner,',
      '\\} from "@causa/runtime";',
      'import \\{ CustomStatus, MyEntity \\} from "\\./models/entity\\.js";',
      // `expectMyEntity`.
      'export async function expectMyEntity\\(',
      'runner: TransactionRunner<Transaction, ReadOnlyStateTransaction>,',
      'expected: Partial<MyEntity>,',
      '\\): Promise<MyEntity> \\{',
      'const actual = await runner\\.run\\(\\(t\\) => t\\.get\\(MyEntity, expected\\)\\);',
      'expect\\(actual\\)\\.toEqual\\(\\{',
      'active: expect\\.any\\(Boolean\\),',
      'age: expect\\.any\\(Number\\),',
      'constantStatus: \"🪨\",',
      'createdAt: expect\\.any\\(Date\\),',
      'id: expect\\.any\\(String\\),',
      'metadata: expect\\.any\\(Object\\),',
      'name: expect\\.any\\(String\\),',
      'nullableField: expect\\.toBeOneOf\\(\\[null, expect\\.any\\(String\\)\\]\\),',
      'optionalEnum: expect\\.toBeOneOf\\(\\[undefined, \\.\\.\\.Object\\.values\\(CustomStatus\\)\\]\\),',
      'optionalNullable: expect\\.toBeOneOf\\(\\[undefined, null, expect\\.any\\(Number\\)\\]\\),',
      'optionalString: expect\\.toBeOneOf\\(\\[undefined, expect\\.any\\(String\\)\\]\\),',
      'status: expect\\.toBeOneOf\\(Object\\.values\\(CustomStatus\\)\\),',
      'tags: expect\\.any\\(Array\\),',
      '\\.\\.\\.expected,',
      '\\}\\);',
      'return actual as MyEntity;',
      '\\}',
      // `expectMyEntityNotToExist`.
      'export async function expectMyEntityNotToExist\\(',
      'runner: TransactionRunner<Transaction, ReadOnlyStateTransaction>,',
      'key: Partial<MyEntity>,',
      '\\): Promise<void> \\{',
      'const actual = await runner\\.run\\(\\(t\\) => t\\.get\\(MyEntity, key\\)\\);',
      'expect\\(actual\\)\\.toEqual\\(null\\);',
      '\\}',
    ]);
    expect(language.generatedSchemas).toEqual({
      [schemaUri]: {
        name: 'expectMyEntity,expectMyEntityNotToExist',
        file: outputFile,
      },
    });
  });

  it('should handle constraint types correctly', async () => {
    const schemaWithConstraint = {
      title: 'Person',
      type: 'object',
      additionalProperties: false,
      properties: {
        name: { type: 'string' },
        age: { oneOf: [{ type: 'integer' }, { type: 'null' }] },
        dummyRefToConstraint: {
          oneOf: [{ $ref: '#/$defs/PersonWithAgeConstraint' }],
        },
      },
      required: ['name', 'age', 'dummyRefToConstraint'],
      $defs: {
        PersonWithAgeConstraint: {
          title: 'PersonWithAgeConstraint',
          type: 'object',
          additionalProperties: false,
          causa: { constraintFor: '#' },
          properties: { age: { type: 'integer' } },
          required: ['age'],
        },
      },
    };
    const modelClassOutputFile = join(tmpDir, 'model.ts');
    const modelClassSchemas = {
      [schemaUri]: { name: 'Person', file: modelClassOutputFile },
      [`${schemaUri}#/$defs/PersonWithAgeConstraint`]: {
        name: 'PersonWithAge',
        file: modelClassOutputFile,
      },
    };
    const eventTopics: EventTopicDefinition[] = [];
    const languageBase = new TypeScriptTestExpectationTargetLanguage(
      outputFile,
      context,
      { modelClassSchemas, eventTopics, generatorOptions },
    );

    const generatedCode = await generateFromSchema(
      languageBase,
      schemaWithConstraint,
      outputFile,
      schemaUri,
    );

    expectToMatchRegexParts(generatedCode, [
      'import \\{ Person, type PersonWithAge \\} from "\\./model\\.js";',
      'export async function expectPersonWithAge\\(',
      'runner: TransactionRunner<Transaction, ReadOnlyStateTransaction>,',
      'expected: Partial<PersonWithAge>,',
      '\\): Promise<PersonWithAge> \\{',
      'const actual = await runner.run\\(\\(t\\) => t.get\\(Person, expected\\)\\);',
      'expect\\(actual\\).toEqual\\(\\{',
      'age: expect\\.any\\(Number\\),',
      'dummyRefToConstraint: expect\\.any\\(PersonWithAge\\),',
      'name: expect\\.any\\(String\\),',
      '\\.\\.\\.expected,',
      '\\}\\);',
      'return actual as PersonWithAge;',
      '\\}',
    ]);
    expect(languageBase.generatedSchemas).toEqual({
      [schemaUri]: {
        name: 'expectPerson,expectPersonNotToExist',
        file: outputFile,
      },
      [`${schemaUri}#/$defs/PersonWithAgeConstraint`]: {
        name: 'expectPersonWithAge',
        file: outputFile,
      },
    });
  });

  it('should not generate expectations for types not matching entitiesGlobs', async () => {
    const schema = {
      type: 'object',
      title: 'NonEntity',
      properties: { id: { type: 'string' } },
      required: ['id'],
    };
    const modelClassSchemas: GeneratedSchemas = {
      [schemaUri]: {
        file: join(tmpDir, 'models/non-entity.ts'),
        name: 'NonEntity',
      },
    };
    const eventTopics: EventTopicDefinition[] = [];
    const language = new TypeScriptTestExpectationTargetLanguage(
      outputFile,
      context,
      {
        modelClassSchemas,
        eventTopics,
        generatorOptions: { entitiesGlobs: ['**/entities/*.json'] },
      },
    );

    const generatedCode = await generateFromSchema(
      language,
      schema,
      outputFile,
      schemaUri,
    );

    expect(generatedCode).toBeEmpty();
    expect(language.generatedSchemas).toEqual({});
  });

  it('should not generate code for enums', async () => {
    const schema = {
      type: 'string',
      title: 'MyEnum',
      enum: ['value1', 'value2', 'value3'],
    };
    const modelClassSchemas: GeneratedSchemas = {
      [schemaUri]: {
        file: join(tmpDir, 'models/enum.ts'),
        name: 'MyEnum',
      },
    };
    const eventTopics: EventTopicDefinition[] = [];
    const language = new TypeScriptTestExpectationTargetLanguage(
      outputFile,
      context,
      {
        modelClassSchemas,
        eventTopics,
        generatorOptions,
      },
    );

    const generatedCode = await generateFromSchema(
      language,
      schema,
      outputFile,
      schemaUri,
    );

    expect(generatedCode).toBeEmpty();
    expect(language.generatedSchemas).toEqual({});
  });

  it('should handle complex nested types', async () => {
    const schema = {
      type: 'object',
      title: 'NestedEntity',
      properties: {
        id: { type: 'string' },
        nested: { oneOf: [{ $ref: '#/definitions/NestedObject' }] },
        unionProp: {
          oneOf: [{ type: 'string' }, { type: 'number' }, { type: 'boolean' }],
        },
      },
      required: ['id', 'nested', 'unionProp'],
      definitions: {
        NestedObject: {
          type: 'object',
          title: 'NestedObject',
          properties: {
            field1: { type: 'string' },
            field2: { type: 'integer' },
          },
          required: ['field1', 'field2'],
        },
      },
    };
    const modelClassSchemas: GeneratedSchemas = {
      [schemaUri]: {
        file: join(tmpDir, 'models/nested.ts'),
        name: 'NestedEntity',
      },
      [`${schemaUri}#/definitions/NestedObject`]: {
        file: join(tmpDir, 'models/nested.ts'),
        name: 'NestedObject',
      },
    };
    const eventTopics: EventTopicDefinition[] = [];
    const language = new TypeScriptTestExpectationTargetLanguage(
      outputFile,
      context,
      {
        modelClassSchemas,
        eventTopics,
        generatorOptions,
      },
    );

    const generatedCode = await generateFromSchema(
      language,
      schema,
      outputFile,
      schemaUri,
    );

    expectToMatchRegexParts(generatedCode, [
      'import \\{ NestedEntity, NestedObject \\} from "\\./models/nested\\.js";',
      'export async function expectNestedEntity\\(',
      'runner: TransactionRunner<Transaction, ReadOnlyStateTransaction>,',
      'expected: Partial<NestedEntity>,',
      '\\): Promise<NestedEntity> \\{',
      'const actual = await runner.run\\(\\(t\\) => t.get\\(NestedEntity, expected\\)\\);',
      'expect\\(actual\\).toEqual\\(\\{',
      'id: expect\\.any\\(String\\),',
      'nested: expect\\.any\\(NestedObject\\),',
      'unionProp: expect\\.toBeOneOf\\(\\[',
      'expect\\.any\\(Number\\),',
      'expect\\.any\\(Boolean\\)',
      'expect\\.any\\(String\\),',
      '\\]\\),',
      '\\.\\.\\.expected,',
      '\\}\\);',
      'return actual as NestedEntity;',
      '\\}',
    ]);
    expect(language.generatedSchemas).toEqual({
      [schemaUri]: {
        name: 'expectNestedEntity,expectNestedEntityNotToExist',
        file: outputFile,
      },
      [`${schemaUri}#/definitions/NestedObject`]: {
        name: 'expectNestedObject,expectNestedObjectNotToExist',
        file: outputFile,
      },
    });
  });

  it('should generate generic event expectations for event topics', async () => {
    const schema = {
      title: 'EntityEvent',
      type: 'object',
      properties: {
        id: { type: 'string', format: 'uuid' },
        producedAt: { type: 'string', format: 'date-time' },
        name: {
          type: 'string',
          title: 'EventName',
          enum: ['entityCreated', 'entityUpdated'],
        },
        data: { oneOf: [{ $ref: '#/$defs/Entity' }] },
      },
      required: ['id', 'producedAt', 'name', 'data'],
      $defs: {
        Entity: {
          title: 'Entity',
          type: 'object',
          properties: {
            prop1: { type: 'string' },
            prop2: { oneOf: [{ type: 'string' }, { type: 'null' }] },
          },
          required: ['prop1', 'prop2'],
        },
      },
    };
    const modelClassSchemas: GeneratedSchemas = {
      [schemaUri]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'EntityEvent',
      },
      [`${schemaUri}#/$defs/Entity`]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'Entity',
      },
      [`${schemaUri}#/properties/name`]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'EventName',
      },
    };
    const eventTopics: EventTopicDefinition[] = [
      { id: 'entity-events', schemaFilePath: schemaUri, formatParts: {} },
    ];
    const language = new TypeScriptTestExpectationTargetLanguage(
      outputFile,
      context,
      { modelClassSchemas, eventTopics, generatorOptions: {} },
    );

    const generatedCode = await generateFromSchema(
      language,
      schema,
      outputFile,
      schemaUri,
    );

    expectToMatchRegexParts(generatedCode, [
      'import \\{ type EventFixture \\} from "@causa/runtime/nestjs/testing";',
      'import \\{ Entity, EntityEvent, EventName \\} from "\\./models/event\\.js";',
      'export async function expectEntityEvent\\(',
      'eventFixture: EventFixture,',
      'expected: Partial<EntityEvent> = \\{\\},',
      '\\): Promise<void> \\{',
      'await eventFixture\\.expectEvent\\("entity-events", \\{',
      'data: expect\\.any\\(Entity\\),',
      'id: expect\\.any\\(String\\),',
      'name: expect\\.toBeOneOf\\(Object\\.values\\(EventName\\)\\),',
      'producedAt: expect\\.any\\(Date\\),',
      '\\.\\.\\.expected,',
      '\\}\\);',
      '\\}',
      'export async function expectNoEntityEvent\\(',
      'eventFixture: EventFixture,',
      '\\): Promise<void> \\{',
      'await eventFixture\\.expectNoEvent\\("entity-events"\\);',
      '\\}',
    ]);
    expect(language.generatedSchemas).toEqual({
      [schemaUri]: {
        name: 'expectEntityEvent,expectNoEntityEvent',
        file: outputFile,
      },
      [`${schemaUri}#/$defs/Entity`]: {
        name: 'expectEntity,expectEntityNotToExist',
        file: outputFile,
      },
    });
  });

  it('should generate entity event not mutated expectation for entity events', async () => {
    const schema = {
      title: 'EntityEvent',
      type: 'object',
      causa: { entityEvent: true },
      properties: {
        id: { type: 'string', format: 'uuid' },
        producedAt: { type: 'string', format: 'date-time' },
        name: {
          type: 'string',
          title: 'EventName',
          enum: ['entityCreated', 'entityUpdated'],
        },
        data: { oneOf: [{ $ref: '#/$defs/Entity' }] },
      },
      required: ['id', 'producedAt', 'name', 'data'],
      $defs: {
        Entity: {
          title: 'Entity',
          type: 'object',
          properties: {
            prop1: { type: 'string' },
            prop2: { oneOf: [{ type: 'string' }, { type: 'null' }] },
          },
          required: ['prop1', 'prop2'],
        },
      },
    };
    const modelClassSchemas: GeneratedSchemas = {
      [schemaUri]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'EntityEvent',
      },
      [`${schemaUri}#/$defs/Entity`]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'Entity',
      },
      [`${schemaUri}#/properties/name`]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'EventName',
      },
    };
    const eventTopics: EventTopicDefinition[] = [
      { id: 'entity-events', schemaFilePath: schemaUri, formatParts: {} },
    ];
    const language = new TypeScriptTestExpectationTargetLanguage(
      outputFile,
      context,
      { modelClassSchemas, eventTopics, generatorOptions: {} },
    );

    const generatedCode = await generateFromSchema(
      language,
      schema,
      outputFile,
      schemaUri,
    );

    expectToMatchRegexParts(generatedCode, [
      'import \\{',
      'type AppFixture,',
      'type EventFixture,',
      '\\} from "@causa/runtime/nestjs/testing";',
      'import \\{ VersionedEntityFixture \\} from "@causa/runtime/testing";',
      'export async function expectEntityNotMutated\\(',
      'fixture: AppFixture,',
      'entity: Entity,',
      'tests: \\{ expectNoEvent\\?: boolean \\} = \\{\\},',
      '\\): Promise<void> \\{',
      'await fixture',
      '\\.get\\(VersionedEntityFixture\\)',
      '\\.expectNoMutation\\(entity, \\{',
      'expectNoEventInTopic: tests\\.expectNoEvent \\? "entity-events" : undefined,',
      '\\}\\);',
      '\\}',
    ]);
    expect(language.generatedSchemas).toEqual({
      [schemaUri]: {
        name: 'expectEntityNotMutated,expectEntityEvent,expectNoEntityEvent',
        file: outputFile,
      },
      [`${schemaUri}#/$defs/Entity`]: {
        name: 'expectEntity,expectEntityNotToExist',
        file: outputFile,
      },
    });
  });

  it('should generate entity mutated expectation for constraints with entityMutationFrom', async () => {
    const schema = {
      title: 'EntityEvent',
      type: 'object',
      causa: { entityEvent: true },
      properties: {
        id: { type: 'string', format: 'uuid' },
        producedAt: { type: 'string', format: 'date-time' },
        name: {
          type: 'string',
          title: 'EventName',
          enum: ['entityCreated', 'entityUpdated'],
        },
        data: { oneOf: [{ $ref: '#/$defs/Entity' }] },
        _dummyRefToConstraint1: {
          oneOf: [{ $ref: '#/$defs/EntityCreatedEventConstraint' }],
        },
        _dummyRefToConstraint2: {
          oneOf: [{ $ref: '#/$defs/EntityUpdatedEventConstraint' }],
        },
      },
      required: ['id', 'producedAt', 'name', 'data'],
      $defs: {
        Entity: {
          title: 'Entity',
          type: 'object',
          properties: {
            prop1: { type: 'string' },
            prop2: { oneOf: [{ type: 'string' }, { type: 'null' }] },
          },
          required: ['prop1', 'prop2'],
        },
        EntityNotNullConstraint: {
          title: 'EntityNotNullConstraint',
          type: 'object',
          causa: { constraintFor: '#/$defs/Entity' },
          properties: {
            prop2: { type: 'string' },
          },
          required: ['prop2'],
        },
        EntityCreatedEventConstraint: {
          title: 'EntityCreatedEventConstraint',
          type: 'object',
          causa: {
            constraintFor: '#',
            entityMutationFrom: [null],
            entityPropertyChanges: '*',
          },
          properties: {
            name: { const: 'entityCreated' },
          },
          required: ['name'],
        },
        EntityUpdatedEventConstraint: {
          title: 'EntityUpdatedEventConstraint',
          type: 'object',
          causa: {
            constraintFor: '#',
            entityMutationFrom: ['#/$defs/Entity'],
            entityPropertyChanges: ['prop2'],
          },
          properties: {
            name: { const: 'entityUpdated' },
            data: { oneOf: [{ $ref: '#/$defs/EntityNotNullConstraint' }] },
          },
          required: ['name', 'data'],
        },
      },
    };
    const modelClassSchemas: GeneratedSchemas = {
      [schemaUri]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'EntityEvent',
      },
      [`${schemaUri}#/$defs/Entity`]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'Entity',
      },
      [`${schemaUri}#/$defs/EntityNotNullConstraint`]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'EntityNotNull',
      },
      [`${schemaUri}#/$defs/EntityCreatedEventConstraint`]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'EntityCreatedEvent',
      },
      [`${schemaUri}#/$defs/EntityUpdatedEventConstraint`]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'EntityUpdatedEvent',
      },
      [`${schemaUri}#/properties/name`]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'EventName',
      },
    };
    const eventTopics: EventTopicDefinition[] = [
      { id: 'entity-events', schemaFilePath: schemaUri, formatParts: {} },
    ];
    const language = new TypeScriptTestExpectationTargetLanguage(
      outputFile,
      context,
      { modelClassSchemas, eventTopics, generatorOptions: {} },
    );

    const generatedCode = await generateFromSchema(
      language,
      schema,
      outputFile,
      schemaUri,
    );

    expectToMatchRegexParts(generatedCode, [
      'import \\{',
      'type EventAttributes,',
      '\\} from "@causa/runtime";',
      'import \\{',
      'type AppFixture,',
      'type EventFixture,',
      '\\} from "@causa/runtime/nestjs/testing";',
      'import \\{ VersionedEntityFixture \\} from "@causa/runtime/testing";',
      'import \\{',
      'Entity,',
      'EntityEvent,',
      'EventName,',
      'type EntityNotNull,',
      '\\} from "\\./models/event\\.js";',
      // EntityCreatedEvent expectation.
      'export async function expectEntityCreatedEvent\\(',
      'fixture: AppFixture,',
      'before: Partial<Entity>,',
      'updates: Partial<Entity> = \\{\\},',
      'tests: \\{',
      'matchesHttpResponse\\?: object;',
      'eventAttributes\\?: EventAttributes;',
      '\\} = \\{\\},',
      '\\): Promise<Entity> \\{',
      'return await fixture',
      '\\.get\\(VersionedEntityFixture\\)',
      '\\.expectMutated\\(',
      '\\{ type: Entity, entity: before \\},',
      '\\{',
      'expectedEntity: \\{',
      'prop1: expect\\.any\\(String\\),',
      'prop2: expect\\.toBeOneOf\\(\\[null, expect\\.any\\(String\\)\\]\\),',
      '\\.\\.\\.updates,',
      '\\},',
      'expectedEvent: \\{',
      'topic: "entity-events",',
      'name: expect.toBeOneOf\\(\\["entityCreated"\\]\\),',
      'attributes: tests\\.eventAttributes,',
      '\\},',
      'matchesHttpResponse: tests\\.matchesHttpResponse,',
      '\\},',
      '\\);',
      '\\}',
      // EntityUpdatedEvent expectation
      'export async function expectEntityUpdatedEvent\\(',
      'fixture: AppFixture,',
      'before: Partial<Entity>,',
      'updates: Partial<EntityNotNull> = \\{\\},',
      'tests: \\{',
      'matchesHttpResponse\\?: object;',
      'eventAttributes\\?: EventAttributes;',
      '\\} = \\{\\},',
      '\\): Promise<Entity> \\{',
      'return await fixture',
      '\\.get\\(VersionedEntityFixture\\)',
      '\\.expectMutated\\(',
      '\\{ type: Entity, entity: before \\},',
      '\\{',
      'expectedEntity: \\{',
      'prop1: expect\\.any\\(String\\),',
      '\\.\\.\\.before,',
      'prop2: expect\\.any\\(String\\),',
      '\\.\\.\\.updates,',
      '\\},',
      'expectedEvent: \\{',
      'topic: "entity-events",',
      'name: expect.toBeOneOf\\(\\["entityUpdated"\\]\\),',
      'attributes: tests\\.eventAttributes,',
      '\\},',
      'matchesHttpResponse: tests\\.matchesHttpResponse,',
      '\\},',
      '\\);',
      '\\}',
    ]);
    expect(language.generatedSchemas).toEqual({
      [schemaUri]: {
        name: 'expectEntityNotMutated,expectEntityEvent,expectNoEntityEvent',
        file: outputFile,
      },
      [`${schemaUri}#/$defs/EntityCreatedEventConstraint`]: {
        name: 'expectEntityCreatedEvent',
        file: outputFile,
      },
      [`${schemaUri}#/$defs/EntityUpdatedEventConstraint`]: {
        name: 'expectEntityUpdatedEvent',
        file: outputFile,
      },
      [`${schemaUri}#/$defs/Entity`]: {
        name: 'expectEntity,expectEntityNotToExist',
        file: outputFile,
      },
      [`${schemaUri}#/$defs/EntityNotNullConstraint`]: {
        name: 'expectEntityNotNull',
        file: outputFile,
      },
    });
  });
});
