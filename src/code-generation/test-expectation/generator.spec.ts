import type {
  EventTopicDefinition,
  GeneratedSchemas,
  Schema,
} from '@causa/workspace-core';
import { mkdtemp, readFile, rm } from 'fs/promises';
import 'jest-extended';
import { tmpdir } from 'os';
import { join } from 'path';
import { TypeScriptTestExpectationGenerator } from './generator.js';

function expectToMatchRegexParts(str: string, parts: string[]): void {
  expect(str).toMatch(new RegExp(parts.join('(.|\\n)*')));
}

describe('TypeScriptTestExpectationGenerator', () => {
  let tmpDir: string;
  let outputFile: string;
  let schemaUri: string;
  let entitiesGlobs: string[];

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'causa-test-'));
    outputFile = join(tmpDir, 'test-output.ts');
    schemaUri = join(tmpDir, 'test.json');
    entitiesGlobs = [join(tmpDir, 'test.json')];
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  async function generate(
    schemas: Record<string, Schema>,
    modelClassSchemas: GeneratedSchemas,
    eventTopics: EventTopicDefinition[],
    options: {
      entitiesGlobs?: string[];
    } = {},
  ): Promise<{ source: string; generatedSchemas: GeneratedSchemas }> {
    const generator = new TypeScriptTestExpectationGenerator(
      outputFile,
      schemas,
      modelClassSchemas,
      eventTopics,
      options,
    );
    await generator.generate();
    const source = await readFile(outputFile, 'utf-8');
    return { source, generatedSchemas: generator.generatedSchemas };
  }

  it('should generate entity expectation functions', async () => {
    const STATUS_PATH = `${schemaUri}#/definitions/Status`;
    const schemas: Record<string, Schema> = {
      [schemaUri]: {
        kind: 'object',
        name: 'MyEntity',
        path: schemaUri,
        extensions: {},
        databases: [],
        additionalProperties: false,
        properties: [
          {
            name: 'id',
            type: { kind: 'primitive', type: 'string' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'name',
            type: { kind: 'primitive', type: 'string' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'age',
            type: { kind: 'primitive', type: 'integer' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'active',
            type: { kind: 'primitive', type: 'boolean' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'tags',
            type: {
              kind: 'array',
              items: { kind: 'primitive', type: 'string' },
              itemNullable: false,
            },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'metadata',
            type: { kind: 'map', items: 'any' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'createdAt',
            type: { kind: 'primitive', type: 'datetime' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'status',
            type: { kind: 'ref', ref: STATUS_PATH },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'constantStatus',
            type: { kind: 'const', type: 'string', value: '🪨' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'nonStringConst',
            type: { kind: 'const', type: 'integer', value: 42 },
            nullable: false,
            required: false,
            extensions: {},
          },
          {
            name: 'nullableField',
            type: { kind: 'primitive', type: 'string' },
            nullable: true,
            required: true,
            extensions: {},
          },
          {
            name: 'optionalString',
            type: { kind: 'primitive', type: 'string' },
            nullable: false,
            required: false,
            extensions: {},
          },
          {
            name: 'optionalNullable',
            type: { kind: 'primitive', type: 'integer' },
            nullable: true,
            required: false,
            extensions: {},
          },
          {
            name: 'optionalEnum',
            type: { kind: 'ref', ref: STATUS_PATH },
            nullable: false,
            required: false,
            extensions: {},
          },
        ],
      },
      [STATUS_PATH]: {
        kind: 'enum',
        type: 'string',
        name: 'Status',
        path: STATUS_PATH,
        extensions: {},
        values: ['active', 'inactive', 'pending'],
      },
    };
    const modelClassSchemas: GeneratedSchemas = {
      [schemaUri]: {
        file: join(tmpDir, 'models/entity.ts'),
        name: 'MyEntity',
      },
      [STATUS_PATH]: {
        file: join(tmpDir, 'models/entity.ts'),
        name: 'CustomStatus',
      },
    };

    const { source, generatedSchemas } = await generate(
      schemas,
      modelClassSchemas,
      [],
      { entitiesGlobs },
    );

    expectToMatchRegexParts(source, [
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
      'const actual = await runner\\.run\\(\\{ readOnly: true \\}, \\(t\\) =>\\s*t\\.get\\(MyEntity, expected\\)',
      'expect\\(actual\\)\\.toEqual\\(\\{',
      'active: expect\\.any\\(Boolean\\),',
      'age: expect\\.any\\(Number\\),',
      'constantStatus: "🪨",',
      'createdAt: expect\\.any\\(Date\\),',
      'id: expect\\.any\\(String\\),',
      'metadata: expect\\.any\\(Object\\),',
      'name: expect\\.any\\(String\\),',
      'nonStringConst: expect\\.toBeOneOf\\(\\[undefined, 42\\]\\),',
      'nullableField: expect\\.toBeOneOf\\(\\[null, expect\\.any\\(String\\)\\]\\),',
      'optionalEnum: expect\\.toBeOneOf\\(\\[',
      'undefined,',
      'CustomStatus\\.Active,',
      'CustomStatus\\.Inactive,',
      'CustomStatus\\.Pending,',
      '\\]\\),',
      'optionalNullable: expect\\.toBeOneOf\\(\\[undefined, null, expect\\.any\\(Number\\)\\]\\),',
      'optionalString: expect\\.toBeOneOf\\(\\[undefined, expect\\.any\\(String\\)\\]\\),',
      'status: expect\\.toBeOneOf\\(\\[',
      'CustomStatus\\.Active,',
      'CustomStatus\\.Inactive,',
      'CustomStatus\\.Pending,',
      '\\]\\),',
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
      'const actual = await runner\\.run\\(\\{ readOnly: true \\}, \\(t\\) =>\\s*t\\.get\\(MyEntity, key\\)',
      'expect\\(actual\\)\\.toEqual\\(null\\);',
      '\\}',
    ]);
    expect(generatedSchemas).toEqual({
      [schemaUri]: {
        name: 'expectMyEntity,expectMyEntityNotToExist',
        file: outputFile,
      },
    });
  });

  it('should handle constraint types correctly', async () => {
    const CONSTRAINT_PATH = `${schemaUri}#/$defs/PersonWithAgeConstraint`;
    const schemas: Record<string, Schema> = {
      [schemaUri]: {
        kind: 'object',
        name: 'Person',
        path: schemaUri,
        extensions: {},
        databases: [],
        additionalProperties: false,
        properties: [
          {
            name: 'name',
            type: { kind: 'primitive', type: 'string' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'age',
            type: { kind: 'primitive', type: 'integer' },
            nullable: true,
            required: true,
            extensions: {},
          },
          {
            name: 'dummyRefToConstraint',
            type: { kind: 'ref', ref: CONSTRAINT_PATH },
            nullable: false,
            required: true,
            extensions: {},
          },
        ],
      },
      [CONSTRAINT_PATH]: {
        kind: 'object',
        name: 'PersonWithAgeConstraint',
        path: CONSTRAINT_PATH,
        extensions: { constraintFor: schemaUri },
        databases: [],
        additionalProperties: false,
        properties: [
          {
            name: 'age',
            type: { kind: 'primitive', type: 'integer' },
            nullable: false,
            required: true,
            extensions: {},
          },
        ],
      },
    };
    const modelClassOutputFile = join(tmpDir, 'model.ts');
    const modelClassSchemas: GeneratedSchemas = {
      [schemaUri]: { name: 'Person', file: modelClassOutputFile },
      [CONSTRAINT_PATH]: {
        name: 'PersonWithAge',
        file: modelClassOutputFile,
      },
    };

    const { source, generatedSchemas } = await generate(
      schemas,
      modelClassSchemas,
      [],
      { entitiesGlobs },
    );

    expectToMatchRegexParts(source, [
      'import \\{ Person, type PersonWithAge \\} from "\\./model\\.js";',
      'export async function expectPersonWithAge\\(',
      'runner: TransactionRunner<Transaction, ReadOnlyStateTransaction>,',
      'expected: Partial<PersonWithAge>,',
      '\\): Promise<PersonWithAge> \\{',
      'const actual = await runner\\.run\\(\\{ readOnly: true \\}, \\(t\\) =>\\s*t\\.get\\(Person, expected\\)',
      'expect\\(actual\\).toEqual\\(\\{',
      'age: expect\\.any\\(Number\\),',
      'dummyRefToConstraint: expect\\.any\\(Person\\),',
      'name: expect\\.any\\(String\\),',
      '\\.\\.\\.expected,',
      '\\}\\);',
      'return actual as PersonWithAge;',
      '\\}',
    ]);
    expect(generatedSchemas).toEqual({
      [schemaUri]: {
        name: 'expectPerson,expectPersonNotToExist',
        file: outputFile,
      },
      [CONSTRAINT_PATH]: {
        name: 'expectPersonWithAge',
        file: outputFile,
      },
    });
  });

  it('should not generate expectations for types not matching entitiesGlobs', async () => {
    const schemas: Record<string, Schema> = {
      [schemaUri]: {
        kind: 'object',
        name: 'NonEntity',
        path: schemaUri,
        extensions: {},
        databases: [],
        additionalProperties: false,
        properties: [
          {
            name: 'id',
            type: { kind: 'primitive', type: 'string' },
            nullable: false,
            required: true,
            extensions: {},
          },
        ],
      },
    };
    const modelClassSchemas: GeneratedSchemas = {
      [schemaUri]: {
        file: join(tmpDir, 'models/non-entity.ts'),
        name: 'NonEntity',
      },
    };

    const { source, generatedSchemas } = await generate(
      schemas,
      modelClassSchemas,
      [],
      { entitiesGlobs: ['**/entities/*.json'] },
    );

    expect(source).not.toInclude('export ');
    expect(generatedSchemas).toEqual({});
  });

  it('should not generate code for enums', async () => {
    const schemas: Record<string, Schema> = {
      [schemaUri]: {
        kind: 'enum',
        type: 'string',
        name: 'MyEnum',
        path: schemaUri,
        extensions: {},
        values: ['value1', 'value2', 'value3'],
      },
    };
    const modelClassSchemas: GeneratedSchemas = {
      [schemaUri]: {
        file: join(tmpDir, 'models/enum.ts'),
        name: 'MyEnum',
      },
    };

    const { source, generatedSchemas } = await generate(
      schemas,
      modelClassSchemas,
      [],
      { entitiesGlobs },
    );

    expect(source).not.toInclude('export ');
    expect(generatedSchemas).toEqual({});
  });

  it('should handle complex nested types', async () => {
    const NESTED_PATH = `${schemaUri}#/definitions/NestedObject`;
    const UNION_PATH = `${schemaUri}#/properties/unionProp`;
    const schemas: Record<string, Schema> = {
      [schemaUri]: {
        kind: 'object',
        name: 'NestedEntity',
        path: schemaUri,
        extensions: {},
        databases: [],
        additionalProperties: false,
        properties: [
          {
            name: 'id',
            type: { kind: 'primitive', type: 'string' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'nested',
            type: { kind: 'ref', ref: NESTED_PATH },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'unionProp',
            type: { kind: 'ref', ref: UNION_PATH },
            nullable: false,
            required: true,
            extensions: {},
          },
        ],
      },
      [NESTED_PATH]: {
        kind: 'object',
        name: 'NestedObject',
        path: NESTED_PATH,
        extensions: {},
        databases: [],
        additionalProperties: false,
        properties: [
          {
            name: 'field1',
            type: { kind: 'primitive', type: 'string' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'field2',
            type: { kind: 'primitive', type: 'integer' },
            nullable: false,
            required: true,
            extensions: {},
          },
        ],
      },
      [UNION_PATH]: {
        kind: 'union',
        combiner: 'oneOf',
        name: 'UnionProp',
        path: UNION_PATH,
        extensions: {},
        types: [
          { kind: 'primitive', type: 'string' },
          { kind: 'primitive', type: 'number' },
          { kind: 'primitive', type: 'boolean' },
        ],
      },
    };
    const modelClassSchemas: GeneratedSchemas = {
      [schemaUri]: {
        file: join(tmpDir, 'models/nested.ts'),
        name: 'NestedEntity',
      },
      [NESTED_PATH]: {
        file: join(tmpDir, 'models/nested.ts'),
        name: 'NestedObject',
      },
    };

    const { source, generatedSchemas } = await generate(
      schemas,
      modelClassSchemas,
      [],
      { entitiesGlobs },
    );

    expectToMatchRegexParts(source, [
      'import \\{ NestedEntity, NestedObject \\} from "\\./models/nested\\.js";',
      'export async function expectNestedEntity\\(',
      'runner: TransactionRunner<Transaction, ReadOnlyStateTransaction>,',
      'expected: Partial<NestedEntity>,',
      '\\): Promise<NestedEntity> \\{',
      'const actual = await runner\\.run\\(\\{ readOnly: true \\}, \\(t\\) =>\\s*t\\.get\\(NestedEntity, expected\\)',
      'expect\\(actual\\).toEqual\\(\\{',
      'id: expect\\.any\\(String\\),',
      'nested: expect\\.any\\(NestedObject\\),',
      'unionProp: expect\\.toBeOneOf\\(\\[',
      'expect\\.any\\(String\\),',
      'expect\\.any\\(Number\\),',
      'expect\\.any\\(Boolean\\)',
      '\\]\\),',
      '\\.\\.\\.expected,',
      '\\}\\);',
      'return actual as NestedEntity;',
      '\\}',
    ]);
    expect(generatedSchemas).toEqual({
      [schemaUri]: {
        name: 'expectNestedEntity,expectNestedEntityNotToExist',
        file: outputFile,
      },
      [NESTED_PATH]: {
        name: 'expectNestedObject,expectNestedObjectNotToExist',
        file: outputFile,
      },
    });
  });

  it('should generate generic event expectations for event topics', async () => {
    const ENTITY_PATH = `${schemaUri}#/$defs/Entity`;
    const NAME_PATH = `${schemaUri}#/properties/name`;
    const schemas: Record<string, Schema> = {
      [schemaUri]: {
        kind: 'object',
        name: 'EntityEvent',
        path: schemaUri,
        extensions: {},
        databases: [],
        additionalProperties: false,
        properties: [
          {
            name: 'id',
            type: { kind: 'primitive', type: 'uuid' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'producedAt',
            type: { kind: 'primitive', type: 'datetime' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'name',
            type: { kind: 'ref', ref: NAME_PATH },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'data',
            type: { kind: 'ref', ref: ENTITY_PATH },
            nullable: false,
            required: true,
            extensions: {},
          },
        ],
      },
      [ENTITY_PATH]: {
        kind: 'object',
        name: 'Entity',
        path: ENTITY_PATH,
        extensions: {},
        databases: [],
        additionalProperties: false,
        properties: [
          {
            name: 'prop1',
            type: { kind: 'primitive', type: 'string' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'prop2',
            type: { kind: 'primitive', type: 'string' },
            nullable: true,
            required: true,
            extensions: {},
          },
        ],
      },
      [NAME_PATH]: {
        kind: 'enum',
        type: 'string',
        name: 'EventName',
        path: NAME_PATH,
        extensions: {},
        values: ['entityCreated', 'entityUpdated'],
      },
    };
    const modelClassSchemas: GeneratedSchemas = {
      [schemaUri]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'EntityEvent',
      },
      [ENTITY_PATH]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'Entity',
      },
      [NAME_PATH]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'EventName',
      },
    };
    const eventTopics: EventTopicDefinition[] = [
      { id: 'entity-events', schemaFilePath: schemaUri, formatParts: {} },
    ];

    const { source, generatedSchemas } = await generate(
      schemas,
      modelClassSchemas,
      eventTopics,
      {},
    );

    expectToMatchRegexParts(source, [
      'import \\{ type EventFixture \\} from "@causa/runtime/nestjs/testing";',
      'import \\{ Entity, EntityEvent, EventName \\} from "\\./models/event\\.js";',
      'export async function expectEntityEvent\\(',
      'eventFixture: EventFixture,',
      'expected: Partial<EntityEvent> = \\{\\},',
      '\\): Promise<void> \\{',
      'await eventFixture\\.expectEvent\\("entity-events", \\{',
      'data: expect\\.any\\(Entity\\),',
      'id: expect\\.any\\(String\\),',
      'name: expect\\.toBeOneOf\\(\\[EventName\\.EntityCreated, EventName\\.EntityUpdated\\]\\),',
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
    expect(generatedSchemas).toEqual({
      [schemaUri]: {
        name: 'expectEntityEvent,expectNoEntityEvent',
        file: outputFile,
      },
      [ENTITY_PATH]: {
        name: 'expectEntity,expectEntityNotToExist',
        file: outputFile,
      },
    });
  });

  it('should generate entity event not mutated expectation for entity events', async () => {
    const ENTITY_PATH = `${schemaUri}#/$defs/Entity`;
    const NAME_PATH = `${schemaUri}#/properties/name`;
    const schemas: Record<string, Schema> = {
      [schemaUri]: {
        kind: 'object',
        name: 'EntityEvent',
        path: schemaUri,
        extensions: { entityEvent: true },
        databases: [],
        additionalProperties: false,
        properties: [
          {
            name: 'id',
            type: { kind: 'primitive', type: 'uuid' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'producedAt',
            type: { kind: 'primitive', type: 'datetime' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'name',
            type: { kind: 'ref', ref: NAME_PATH },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'data',
            type: { kind: 'ref', ref: ENTITY_PATH },
            nullable: false,
            required: true,
            extensions: {},
          },
        ],
      },
      [ENTITY_PATH]: {
        kind: 'object',
        name: 'Entity',
        path: ENTITY_PATH,
        extensions: {},
        databases: [],
        additionalProperties: false,
        properties: [
          {
            name: 'prop1',
            type: { kind: 'primitive', type: 'string' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'prop2',
            type: { kind: 'primitive', type: 'string' },
            nullable: true,
            required: true,
            extensions: {},
          },
        ],
      },
      [NAME_PATH]: {
        kind: 'enum',
        type: 'string',
        name: 'EventName',
        path: NAME_PATH,
        extensions: {},
        values: ['entityCreated', 'entityUpdated'],
      },
    };
    const modelClassSchemas: GeneratedSchemas = {
      [schemaUri]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'EntityEvent',
      },
      [ENTITY_PATH]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'Entity',
      },
      [NAME_PATH]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'EventName',
      },
    };
    const eventTopics: EventTopicDefinition[] = [
      { id: 'entity-events', schemaFilePath: schemaUri, formatParts: {} },
    ];

    const { source, generatedSchemas } = await generate(
      schemas,
      modelClassSchemas,
      eventTopics,
      {},
    );

    expectToMatchRegexParts(source, [
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
    expect(generatedSchemas).toEqual({
      [schemaUri]: {
        name: 'expectEntityNotMutated,expectEntityEvent,expectNoEntityEvent',
        file: outputFile,
      },
      [ENTITY_PATH]: {
        name: 'expectEntity,expectEntityNotToExist',
        file: outputFile,
      },
    });
  });

  it('should generate entity mutated expectation for constraints with entityMutationFrom', async () => {
    const ENTITY_PATH = `${schemaUri}#/$defs/Entity`;
    const NAME_PATH = `${schemaUri}#/properties/name`;
    const NOT_NULL_PATH = `${schemaUri}#/$defs/EntityNotNullConstraint`;
    const CREATED_PATH = `${schemaUri}#/$defs/EntityCreatedEventConstraint`;
    const UPDATED_PATH = `${schemaUri}#/$defs/EntityUpdatedEventConstraint`;

    const schemas: Record<string, Schema> = {
      [schemaUri]: {
        kind: 'object',
        name: 'EntityEvent',
        path: schemaUri,
        extensions: { entityEvent: true },
        databases: [],
        additionalProperties: false,
        properties: [
          {
            name: 'id',
            type: { kind: 'primitive', type: 'uuid' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'producedAt',
            type: { kind: 'primitive', type: 'datetime' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'name',
            type: { kind: 'ref', ref: NAME_PATH },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'data',
            type: { kind: 'ref', ref: ENTITY_PATH },
            nullable: false,
            required: true,
            extensions: {},
          },
        ],
      },
      [ENTITY_PATH]: {
        kind: 'object',
        name: 'Entity',
        path: ENTITY_PATH,
        extensions: {},
        databases: [],
        additionalProperties: false,
        properties: [
          {
            name: 'prop1',
            type: { kind: 'primitive', type: 'string' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'prop2',
            type: { kind: 'primitive', type: 'string' },
            nullable: true,
            required: true,
            extensions: {},
          },
        ],
      },
      [NAME_PATH]: {
        kind: 'enum',
        type: 'string',
        name: 'EventName',
        path: NAME_PATH,
        extensions: {},
        values: ['entityCreated', 'entityUpdated'],
      },
      [NOT_NULL_PATH]: {
        kind: 'object',
        name: 'EntityNotNullConstraint',
        path: NOT_NULL_PATH,
        extensions: { constraintFor: ENTITY_PATH },
        databases: [],
        additionalProperties: false,
        properties: [
          {
            name: 'prop2',
            type: { kind: 'primitive', type: 'string' },
            nullable: false,
            required: true,
            extensions: {},
          },
        ],
      },
      [CREATED_PATH]: {
        kind: 'object',
        name: 'EntityCreatedEventConstraint',
        path: CREATED_PATH,
        extensions: {
          constraintFor: schemaUri,
          entityMutationFrom: [null],
          entityPropertyChanges: '*',
        },
        databases: [],
        additionalProperties: false,
        properties: [
          {
            name: 'name',
            type: { kind: 'const', type: 'string', value: 'entityCreated' },
            nullable: false,
            required: true,
            extensions: {},
          },
        ],
      },
      [UPDATED_PATH]: {
        kind: 'object',
        name: 'EntityUpdatedEventConstraint',
        path: UPDATED_PATH,
        extensions: {
          constraintFor: schemaUri,
          entityMutationFrom: [ENTITY_PATH],
          entityPropertyChanges: ['prop2'],
        },
        databases: [],
        additionalProperties: false,
        properties: [
          {
            name: 'name',
            type: { kind: 'const', type: 'string', value: 'entityUpdated' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'data',
            type: { kind: 'ref', ref: NOT_NULL_PATH },
            nullable: false,
            required: true,
            extensions: {},
          },
        ],
      },
    };
    const modelClassSchemas: GeneratedSchemas = {
      [schemaUri]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'EntityEvent',
      },
      [ENTITY_PATH]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'Entity',
      },
      [NOT_NULL_PATH]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'EntityNotNull',
      },
      [CREATED_PATH]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'EntityCreatedEvent',
      },
      [UPDATED_PATH]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'EntityUpdatedEvent',
      },
      [NAME_PATH]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'EventName',
      },
    };
    const eventTopics: EventTopicDefinition[] = [
      { id: 'entity-events', schemaFilePath: schemaUri, formatParts: {} },
    ];

    const { source, generatedSchemas } = await generate(
      schemas,
      modelClassSchemas,
      eventTopics,
      {},
    );

    expectToMatchRegexParts(source, [
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
      // EntityUpdatedEvent expectation.
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
    expect(generatedSchemas).toEqual({
      [schemaUri]: {
        name: 'expectEntityNotMutated,expectEntityEvent,expectNoEntityEvent',
        file: outputFile,
      },
      [CREATED_PATH]: {
        name: 'expectEntityCreatedEvent',
        file: outputFile,
      },
      [UPDATED_PATH]: {
        name: 'expectEntityUpdatedEvent',
        file: outputFile,
      },
      [ENTITY_PATH]: {
        name: 'expectEntity,expectEntityNotToExist',
        file: outputFile,
      },
      [NOT_NULL_PATH]: {
        name: 'expectEntityNotNull',
        file: outputFile,
      },
    });
  });

  it('should generate a multi-variant entity mutated expectation when data is a union of constraints', async () => {
    const ENTITY_PATH = `${schemaUri}#/$defs/Entity`;
    const VARIANT_A_PATH = `${schemaUri}#/$defs/EntityVariantAConstraint`;
    const VARIANT_B_PATH = `${schemaUri}#/$defs/EntityVariantBConstraint`;
    const UNION_PATH = `${schemaUri}#/$defs/EntityVariantUnion`;
    const MUTATION_PATH = `${schemaUri}#/$defs/EntityMutatedEventConstraint`;

    const schemas: Record<string, Schema> = {
      [schemaUri]: {
        kind: 'object',
        name: 'EntityEvent',
        path: schemaUri,
        extensions: {},
        databases: [],
        additionalProperties: false,
        properties: [
          {
            name: 'name',
            type: { kind: 'const', type: 'string', value: 'entityMutated' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'data',
            type: { kind: 'ref', ref: ENTITY_PATH },
            nullable: false,
            required: true,
            extensions: {},
          },
        ],
      },
      [ENTITY_PATH]: {
        kind: 'object',
        name: 'Entity',
        path: ENTITY_PATH,
        extensions: {},
        databases: [],
        additionalProperties: false,
        properties: [
          {
            name: 'id',
            type: { kind: 'primitive', type: 'uuid' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'state',
            type: { kind: 'primitive', type: 'string' },
            nullable: false,
            required: true,
            extensions: {},
          },
        ],
      },
      [VARIANT_A_PATH]: {
        kind: 'object',
        name: 'EntityVariantAConstraint',
        path: VARIANT_A_PATH,
        extensions: { constraintFor: ENTITY_PATH },
        databases: [],
        additionalProperties: false,
        properties: [
          {
            name: 'state',
            type: { kind: 'const', type: 'string', value: 'a' },
            nullable: false,
            required: true,
            extensions: {},
          },
        ],
      },
      [VARIANT_B_PATH]: {
        kind: 'object',
        name: 'EntityVariantBConstraint',
        path: VARIANT_B_PATH,
        extensions: { constraintFor: ENTITY_PATH },
        databases: [],
        additionalProperties: false,
        properties: [
          {
            name: 'state',
            type: { kind: 'const', type: 'string', value: 'b' },
            nullable: false,
            required: true,
            extensions: {},
          },
        ],
      },
      [UNION_PATH]: {
        kind: 'union',
        combiner: 'oneOf',
        name: 'EntityVariantUnion',
        path: UNION_PATH,
        extensions: {},
        types: [
          { kind: 'ref', ref: VARIANT_A_PATH },
          { kind: 'ref', ref: VARIANT_B_PATH },
        ],
      },
      [MUTATION_PATH]: {
        kind: 'object',
        name: 'EntityMutatedEventConstraint',
        path: MUTATION_PATH,
        extensions: {
          constraintFor: schemaUri,
          entityMutationFrom: [ENTITY_PATH],
          entityPropertyChanges: ['state'],
        },
        databases: [],
        additionalProperties: false,
        properties: [
          {
            name: 'data',
            type: { kind: 'ref', ref: UNION_PATH },
            nullable: false,
            required: true,
            extensions: {},
          },
        ],
      },
    };
    const modelClassSchemas: GeneratedSchemas = {
      [schemaUri]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'EntityEvent',
      },
      [ENTITY_PATH]: { file: join(tmpDir, 'models/event.ts'), name: 'Entity' },
      [VARIANT_A_PATH]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'EntityVariantA',
      },
      [VARIANT_B_PATH]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'EntityVariantB',
      },
      [UNION_PATH]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'EntityVariantUnion',
      },
      [MUTATION_PATH]: {
        file: join(tmpDir, 'models/event.ts'),
        name: 'EntityMutatedEvent',
      },
    };
    const eventTopics: EventTopicDefinition[] = [
      { id: 'entity-events', schemaFilePath: schemaUri, formatParts: {} },
    ];

    const { source } = await generate(
      schemas,
      modelClassSchemas,
      eventTopics,
      {},
    );

    expectToMatchRegexParts(source, [
      'export async function expectEntityMutatedEvent\\(',
      'fixture: AppFixture,',
      'before: Partial<Entity>,',
      'updates: Partial<EntityVariantA \\| EntityVariantB> = \\{\\},',
      'expectedEntity: expect\\.toBeOneOf\\(\\[',
      // First variant block.
      'id: expect\\.any\\(String\\),',
      '\\.\\.\\.before,',
      'state: "a",',
      '\\.\\.\\.updates,',
      // Second variant block.
      'id: expect\\.any\\(String\\),',
      '\\.\\.\\.before,',
      'state: "b",',
      '\\.\\.\\.updates,',
      '\\]\\),',
    ]);
  });
});
