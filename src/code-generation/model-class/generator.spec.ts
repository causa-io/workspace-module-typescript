import type { GeneratedSchemas, Schema } from '@causa/workspace-core';
import { mkdtemp, readFile, rm } from 'fs/promises';
import 'jest-extended';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  TypeScriptModelClassGenerator,
  type ModelClassSchemaDecorators,
  type TypeScriptDecorator,
  type TypeScriptModelClassGeneratorOptions,
} from './generator.js';

const ROOT = '/test.json';
const MY_ENUM_PATH = `${ROOT}#/$defs/MyEnum`;
const MY_OTHER_ENUM_PATH = `${ROOT}#/$defs/MyOtherEnum`;
const MY_MERGED_ENUM_PATH = `${ROOT}#/$defs/MyMergedEnum`;
const MY_CHILD_CLASS_PATH = `${ROOT}#/$defs/MyChildClass`;
const MY_CONSTRAINT_PATH = `${ROOT}#/$defs/MyClassWithNullConstraint`;

const SCHEMAS: Record<string, Schema> = {
  [ROOT]: {
    kind: 'object',
    name: 'MyClass',
    path: ROOT,
    description: '📚\n💡',
    extensions: {
      tsDecorators: [
        {
          source: '@ClassDecorator()',
          imports: { 'my-module': ['ClassDecorator'] },
        },
      ],
    },
    databases: [],
    properties: [
      {
        name: 'myProperty',
        type: { kind: 'primitive', type: 'string' },
        nullable: false,
        required: true,
        description: '🎉',
        extensions: {
          tsDecorators: [
            {
              source: '@MyDecorator()',
              imports: { 'my-module': ['MyDecorator'] },
            },
          ],
        },
      },
      {
        name: 'myDate',
        type: { kind: 'primitive', type: 'datetime' },
        nullable: false,
        required: false,
        description: '📅',
        extensions: {},
      },
      {
        name: 'nullableProperty',
        type: { kind: 'primitive', type: 'string' },
        nullable: true,
        required: false,
        extensions: {},
      },
      {
        name: 'myBigInt',
        type: { kind: 'primitive', type: 'integer' },
        nullable: false,
        required: false,
        extensions: { tsType: 'bigint' },
      },
      {
        name: 'myDefaultRequiredProperty',
        type: { kind: 'primitive', type: 'string' },
        nullable: false,
        required: true,
        extensions: { tsDefault: '"💮"' },
      },
      {
        name: 'myOtherDefaultProperty',
        type: { kind: 'primitive', type: 'string' },
        nullable: false,
        required: false,
        extensions: { tsDefault: '"🤷"' },
      },
      {
        name: 'myChildClass',
        type: { kind: 'ref', ref: MY_CHILD_CLASS_PATH },
        nullable: true,
        required: false,
        extensions: {},
      },
      {
        name: 'myEnum',
        type: { kind: 'ref', ref: MY_ENUM_PATH },
        nullable: false,
        required: false,
        extensions: {},
      },
      {
        name: 'myEnumHint',
        type: { kind: 'primitive', type: 'string' },
        nullable: false,
        required: false,
        extensions: { enumHint: MY_ENUM_PATH },
      },
      {
        name: 'myArrayWithEnumHint',
        type: {
          kind: 'array',
          items: { kind: 'primitive', type: 'string' },
          itemNullable: false,
        },
        nullable: false,
        required: false,
        extensions: { enumHint: MY_ENUM_PATH },
      },
      {
        name: 'myNullableArrayWithEnumHint',
        type: {
          kind: 'array',
          items: { kind: 'primitive', type: 'string' },
          itemNullable: true,
        },
        nullable: false,
        required: false,
        extensions: { enumHint: MY_ENUM_PATH },
      },
      {
        name: 'myConst',
        type: { kind: 'const', type: 'string', value: 'a' },
        nullable: false,
        required: false,
        extensions: {},
      },
      {
        name: 'myOtherEnum',
        type: { kind: 'ref', ref: MY_OTHER_ENUM_PATH },
        nullable: false,
        required: false,
        extensions: {},
      },
      {
        name: 'myNonStringConst',
        type: { kind: 'const', type: 'boolean', value: true },
        nullable: false,
        required: false,
        extensions: {},
      },
      {
        name: 'myMergedEnum',
        type: { kind: 'primitive', type: 'string' },
        nullable: false,
        required: false,
        extensions: { enumHint: MY_MERGED_ENUM_PATH },
      },
    ],
  },
  [MY_CHILD_CLASS_PATH]: {
    kind: 'object',
    name: 'MyChildClass',
    path: MY_CHILD_CLASS_PATH,
    extensions: {},
    databases: [],
    properties: [
      {
        name: 'myChildProperty',
        type: { kind: 'primitive', type: 'string' },
        nullable: false,
        required: true,
        extensions: {},
      },
    ],
  },
  [MY_ENUM_PATH]: {
    kind: 'enum',
    name: 'MyEnum',
    path: MY_ENUM_PATH,
    type: 'string',
    values: ['a', 'b', 'c'],
    extensions: {},
  },
  [MY_OTHER_ENUM_PATH]: {
    kind: 'enum',
    name: 'MyOtherEnum',
    path: MY_OTHER_ENUM_PATH,
    type: 'string',
    values: ['b'],
    extensions: {},
  },
  [MY_MERGED_ENUM_PATH]: {
    kind: 'enum',
    name: 'MyMergedEnum',
    path: MY_MERGED_ENUM_PATH,
    type: 'string',
    values: ['SingleValue'],
    extensions: {},
  },
  [MY_CONSTRAINT_PATH]: {
    kind: 'object',
    name: 'MyClassWithNullConstraint',
    path: MY_CONSTRAINT_PATH,
    description: '🗜️',
    extensions: { constraintFor: ROOT },
    databases: [],
    properties: [
      {
        name: 'nullableProperty',
        type: { kind: 'null' },
        nullable: false,
        required: false,
        extensions: {},
      },
    ],
  },
};

const OTHER_DECORATOR: TypeScriptDecorator = {
  source: '@OtherDecorator()',
  imports: { 'some-module': ['OtherDecorator'] },
};
const NULLABLE_DECORATOR: TypeScriptDecorator = {
  source: '@Nullable()',
  imports: {},
};

const DECORATORS: Record<string, ModelClassSchemaDecorators> = {
  [ROOT]: {
    class: [OTHER_DECORATOR],
    properties: { nullableProperty: [NULLABLE_DECORATOR] },
  },
  [MY_CHILD_CLASS_PATH]: {
    class: [OTHER_DECORATOR],
    properties: {},
  },
  [MY_CONSTRAINT_PATH]: {
    class: [OTHER_DECORATOR],
    properties: { nullableProperty: [NULLABLE_DECORATOR] },
  },
};

function expectToMatchRegexParts(str: string, parts: string[]): void {
  expect(str).toMatch(new RegExp(parts.join('(.|\\n)*')));
}

describe('TypeScriptModelClassGenerator', () => {
  let tmpDir: string;
  let outputFile: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'causa-test-'));
    outputFile = join(tmpDir, 'test-output.ts');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  async function generate(
    schemas: Record<string, Schema>,
    options: TypeScriptModelClassGeneratorOptions = {},
  ): Promise<{
    generatedSchemas: GeneratedSchemas;
    source: string;
  }> {
    const generator = new TypeScriptModelClassGenerator(
      outputFile,
      schemas,
      options,
    );
    await generator.generate();
    const source = await readFile(outputFile, 'utf-8');
    return { generatedSchemas: generator.generatedSchemas, source };
  }

  it('should generate a class with properties and decorators', async () => {
    const { source, generatedSchemas } = await generate(SCHEMAS, {
      decorators: DECORATORS,
    });

    expectToMatchRegexParts(source, [
      `import \\{ ClassDecorator, MyDecorator \\} from "my-module";`,
      'export class MyChildClass\\s+\\{',
      '\\}',
      '📚\\n.*💡',
      '@ClassDecorator\\(\\)',
      '@OtherDecorator\\(\\)',
      'export class MyClass\\s+\\{',
      'constructor\\(init: MyClass\\) \\{',
      'Object.assign\\(this, init\\);',
      '\\}',
      '\\}',
    ]);
    expectToMatchRegexParts(source, [
      'export enum MyEnum\\s+\\{',
      'A = "a",',
      'B = "b",',
      'C = "c",',
      '\\}',
    ]);
    expectToMatchRegexParts(source, [
      'export enum MyMergedEnum\\s+\\{',
      'SingleValue = "SingleValue",',
      '\\}',
    ]);
    expectToMatchRegexParts(source, [
      '🎉',
      '@MyDecorator\\(\\)\\n\\s+readonly myProperty!: string;',
    ]);
    expectToMatchRegexParts(source, ['📅', 'readonly myDate\\?: Date;']);
    expectToMatchRegexParts(source, [
      '@Nullable\\(\\)\\n\\s+readonly nullableProperty\\?: string \\| null;',
    ]);
    expectToMatchRegexParts(source, ['readonly myBigInt\\?: bigint;']);
    expectToMatchRegexParts(source, [
      `readonly myDefaultRequiredProperty: string =\\s*["']💮["'];`,
    ]);
    expectToMatchRegexParts(source, [
      `readonly myOtherDefaultProperty: string =\\s*["']🤷["'];`,
    ]);
    expectToMatchRegexParts(source, [
      'readonly myChildClass\\?: MyChildClass \\| null;',
    ]);
    expectToMatchRegexParts(source, ['readonly myEnum\\?: MyEnum;']);
    expectToMatchRegexParts(source, [
      'readonly myEnumHint\\?: string \\| MyEnum;',
    ]);
    expectToMatchRegexParts(source, [
      'readonly myArrayWithEnumHint\\?: \\(string \\| MyEnum\\)\\[\\];',
    ]);
    expectToMatchRegexParts(source, [
      'readonly myNullableArrayWithEnumHint\\?: \\(string \\| null \\| MyEnum\\)\\[\\];',
    ]);
    expectToMatchRegexParts(source, ['readonly myConst\\?: "a";']);
    expectToMatchRegexParts(source, ['readonly myOtherEnum\\?: MyOtherEnum;']);
    expectToMatchRegexParts(source, ['readonly myNonStringConst\\?: true;']);
    expectToMatchRegexParts(source, [
      'readonly myMergedEnum\\?: string \\| MyMergedEnum;',
    ]);
    expectToMatchRegexParts(source, [
      '🗜️',
      'export type MyClassWithNull = MyClass & MyClassWithNullConstraint;',
      '🗜️',
      'export class MyClassWithNullConstraint\\s+\\{',
      'readonly nullableProperty\\?: null;',
      '\\}',
    ]);
    expect(generatedSchemas).toEqual({
      [ROOT]: { name: 'MyClass', file: outputFile },
      [MY_ENUM_PATH]: { name: 'MyEnum', file: outputFile },
      [MY_OTHER_ENUM_PATH]: { name: 'MyOtherEnum', file: outputFile },
      [MY_MERGED_ENUM_PATH]: { name: 'MyMergedEnum', file: outputFile },
      [MY_CHILD_CLASS_PATH]: { name: 'MyChildClass', file: outputFile },
      [MY_CONSTRAINT_PATH]: { name: 'MyClassWithNull', file: outputFile },
    });
  });

  it('should support custom constraint suffix', async () => {
    const rulePath = `${ROOT}#/$defs/MyClassWithNullRule`;
    const schemas: Record<string, Schema> = {
      [ROOT]: {
        kind: 'object',
        name: 'MyClass',
        path: ROOT,
        extensions: {},
        databases: [],
        properties: [
          {
            name: 'dummyRefToRule',
            type: { kind: 'ref', ref: rulePath },
            nullable: false,
            required: false,
            extensions: {},
          },
        ],
      },
      [rulePath]: {
        kind: 'object',
        name: 'MyClassWithNullRule',
        path: rulePath,
        description: '🗜️',
        extensions: { constraintFor: ROOT },
        databases: [],
        properties: [
          {
            name: 'nullableProperty',
            type: { kind: 'null' },
            nullable: false,
            required: false,
            extensions: {},
          },
        ],
      },
    };

    const { source, generatedSchemas } = await generate(schemas, {
      constraintSuffix: 'Rule',
    });

    expectToMatchRegexParts(source, [
      'export type MyClassWithNull = MyClass & MyClassWithNullRule;',
      'export class MyClassWithNullRule',
    ]);
    expect(generatedSchemas).toEqual({
      [ROOT]: { name: 'MyClass', file: outputFile },
      [rulePath]: { name: 'MyClassWithNull', file: outputFile },
    });
  });

  it('should create the output directory if it does not exist', async () => {
    outputFile = join(tmpDir, 'sub', 'dir', 'test-output.ts');
    const { source } = await generate(SCHEMAS);

    expect(source).toContain('export class MyClass');
  });
});
