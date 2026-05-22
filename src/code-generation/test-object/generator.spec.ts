import type { GeneratedSchemas, Schema } from '@causa/workspace-core';
import { mkdtemp, readFile, rm } from 'fs/promises';
import 'jest-extended';
import { tmpdir } from 'os';
import { join } from 'path';
import { TypeScriptTestObjectGenerator } from './generator.js';

function expectToMatchRegexParts(str: string, parts: string[]): void {
  expect(str).toMatch(new RegExp(parts.join('(.|\\n)*')));
}

describe('TypeScriptTestObjectGenerator', () => {
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
    modelClassSchemas: GeneratedSchemas,
  ): Promise<{ source: string; generatedSchemas: GeneratedSchemas }> {
    const generator = new TypeScriptTestObjectGenerator(
      outputFile,
      schemas,
      modelClassSchemas,
    );
    await generator.generate();
    const source = await readFile(outputFile, 'utf-8');
    return { source, generatedSchemas: generator.generatedSchemas };
  }

  it('should generate make functions for objects and references', async () => {
    const TEST_PATH = 'test.json';
    const ENUM_PATH = 'test.json#/$defs/MyEnum';
    const CHILD_PATH = 'test.json#/$defs/ChildClass';
    const UNION_PATH = 'test.json#/$defs/MyUnion';
    const schemas: Record<string, Schema> = {
      [TEST_PATH]: {
        kind: 'object',
        name: 'TestClass',
        path: TEST_PATH,
        description: '🙈',
        extensions: {},
        databases: [],
        properties: [
          {
            name: 'stringProp',
            type: { kind: 'primitive', type: 'string' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'uuidProp',
            type: { kind: 'primitive', type: 'uuid' },
            nullable: false,
            required: false,
            extensions: {},
          },
          {
            name: 'integerProp',
            type: { kind: 'primitive', type: 'integer' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'doubleProp',
            type: { kind: 'primitive', type: 'number' },
            nullable: false,
            required: false,
            extensions: {},
          },
          {
            name: 'boolProp',
            type: { kind: 'primitive', type: 'boolean' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'dateProp',
            type: { kind: 'primitive', type: 'datetime' },
            nullable: false,
            required: false,
            extensions: {},
          },
          {
            name: 'dateTimeProp',
            type: { kind: 'primitive', type: 'datetime' },
            nullable: false,
            required: false,
            extensions: {},
          },
          {
            name: 'arrayProp',
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
            name: 'mapProp',
            type: {
              kind: 'map',
              items: { kind: 'primitive', type: 'string' },
            },
            nullable: false,
            required: false,
            extensions: {},
          },
          {
            name: 'enumHintProp',
            type: { kind: 'primitive', type: 'string' },
            nullable: false,
            required: false,
            extensions: { enumHint: ENUM_PATH },
          },
          {
            name: 'enumProp',
            type: { kind: 'ref', ref: ENUM_PATH },
            nullable: false,
            required: false,
            extensions: {},
          },
          {
            name: 'classProp',
            type: { kind: 'ref', ref: CHILD_PATH },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'constProp',
            type: { kind: 'const', type: 'string', value: '🪨' },
            nullable: false,
            required: false,
            extensions: {},
          },
          {
            name: 'nullableString',
            type: { kind: 'primitive', type: 'string' },
            nullable: true,
            required: false,
            extensions: {},
          },
          {
            name: 'nullableClass',
            type: { kind: 'ref', ref: CHILD_PATH },
            nullable: true,
            required: false,
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
            name: 'optionalInteger',
            type: { kind: 'primitive', type: 'integer' },
            nullable: false,
            required: false,
            extensions: {},
          },
          {
            name: 'defaultStringProp',
            type: { kind: 'primitive', type: 'string' },
            nullable: false,
            required: false,
            extensions: { testObjectDefaultValue: 'something' },
          },
          {
            name: 'arrayOfEnums',
            type: {
              kind: 'array',
              items: { kind: 'ref', ref: ENUM_PATH },
              itemNullable: false,
            },
            nullable: false,
            required: false,
            extensions: { testObjectDefaultValue: ['SECOND', 'THIRD'] },
          },
          {
            name: 'unionProp',
            type: { kind: 'ref', ref: UNION_PATH },
            nullable: false,
            required: false,
            extensions: {},
          },
        ],
      },
      [UNION_PATH]: {
        kind: 'union',
        name: 'MyUnion',
        path: UNION_PATH,
        extensions: {},
        types: [
          { kind: 'primitive', type: 'integer' },
          { kind: 'primitive', type: 'string' },
        ],
      },
      [ENUM_PATH]: {
        kind: 'enum',
        type: 'string',
        name: 'MyEnum',
        path: ENUM_PATH,
        extensions: {},
        values: ['FIRST', 'SECOND', 'THIRD'],
      },
      [CHILD_PATH]: {
        kind: 'object',
        name: 'ChildClass',
        path: CHILD_PATH,
        extensions: {},
        databases: [],
        properties: [
          {
            name: 'childString',
            type: { kind: 'primitive', type: 'string' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'childNumber',
            type: { kind: 'primitive', type: 'integer' },
            nullable: false,
            required: false,
            extensions: {},
          },
        ],
      },
    };
    const modelClassOutputFile = join(tmpDir, 'model.ts');
    const modelClassSchemas: GeneratedSchemas = {
      [TEST_PATH]: { name: 'TestClass', file: modelClassOutputFile },
      [CHILD_PATH]: { name: 'OtherName', file: modelClassOutputFile },
      [ENUM_PATH]: { name: 'MySpecialEnum', file: modelClassOutputFile },
    };

    const { source, generatedSchemas } = await generate(
      schemas,
      modelClassSchemas,
    );

    expect(source).toStartWith(
      '// This file was generated by the Causa command line. Do not edit it manually.',
    );
    expectToMatchRegexParts(source, [
      'import \\{ randomUUID \\} from "crypto";',
      'import \\{ MySpecialEnum, OtherName, TestClass \\} from "\\./model\\.js";',
    ]);
    expectToMatchRegexParts(source, [
      'export function makeTestClass\\(data: Partial<TestClass> = {}\\): TestClass \\{',
      'return new TestClass\\({',
      'arrayOfEnums: \\[MySpecialEnum.Second, MySpecialEnum.Third\\],',
      'arrayProp: \\[\\],',
      'boolProp: false,',
      'classProp: makeOtherName\\(\\),',
      'constProp: "🪨",',
      'dateProp: new Date\\(\\),',
      'dateTimeProp: new Date\\(\\),',
      'defaultStringProp: "something",',
      'doubleProp: 0\\.0,',
      'enumHintProp: "FIRST",',
      'enumProp: MySpecialEnum.First,',
      'integerProp: 0,',
      'mapProp: {},',
      'nullableClass: null,',
      'nullableString: null,',
      'optionalInteger: 0,',
      'optionalString: "string",',
      'stringProp: "string",',
      'unionProp: 0,',
      'uuidProp: randomUUID\\(\\),',
      '...data,',
      '}\\);',
    ]);
    expectToMatchRegexParts(source, [
      'export function makeOtherName\\(data: Partial<OtherName> = {}\\): OtherName \\{',
      'return new OtherName\\({',
      'childNumber: 0,',
      'childString: "string",',
      '...data,',
      '\\}\\);',
      '\\}',
    ]);
    expect(source).not.toContain('enum MyEnum');
    expect(source).not.toContain('🙈');
    expect(generatedSchemas).toEqual({
      [TEST_PATH]: { name: 'makeTestClass', file: outputFile },
      [CHILD_PATH]: { name: 'makeOtherName', file: outputFile },
    });
  });

  it('should handle constraintFor attribute correctly', async () => {
    const TEST_PATH = 'test.json';
    const CONSTRAINT_PATH = 'test.json#/$defs/PersonWithAgeConstraint';
    const schemas: Record<string, Schema> = {
      [TEST_PATH]: {
        kind: 'object',
        name: 'Person',
        path: TEST_PATH,
        extensions: {},
        databases: [],
        properties: [
          {
            name: 'name',
            type: { kind: 'primitive', type: 'string' },
            nullable: false,
            required: true,
            extensions: { testObjectDefaultValue: 'name' },
          },
          {
            name: 'age',
            type: { kind: 'primitive', type: 'integer' },
            nullable: true,
            required: true,
            extensions: {},
          },
          {
            name: 'weight',
            type: { kind: 'primitive', type: 'integer' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'valid',
            type: { kind: 'primitive', type: 'boolean' },
            nullable: false,
            required: false,
            extensions: {},
          },
          {
            name: 'dummyRefToConstraint',
            type: { kind: 'ref', ref: CONSTRAINT_PATH },
            nullable: false,
            required: false,
            extensions: {},
          },
        ],
      },
      [CONSTRAINT_PATH]: {
        kind: 'object',
        name: 'PersonWithAgeConstraint',
        path: CONSTRAINT_PATH,
        extensions: { constraintFor: TEST_PATH },
        databases: [],
        properties: [
          {
            name: 'age',
            type: { kind: 'primitive', type: 'integer' },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'weight',
            type: { kind: 'const', type: 'integer', value: 3 },
            nullable: false,
            required: true,
            extensions: {},
          },
          {
            name: 'valid',
            type: { kind: 'const', type: 'boolean', value: true },
            nullable: false,
            required: false,
            extensions: {},
          },
        ],
      },
    };
    const modelClassOutputFile = join(tmpDir, 'model.ts');
    const modelClassSchemas: GeneratedSchemas = {
      [TEST_PATH]: { name: 'Person', file: modelClassOutputFile },
      [CONSTRAINT_PATH]: {
        name: 'PersonWithAge',
        file: modelClassOutputFile,
      },
    };

    const { source, generatedSchemas } = await generate(
      schemas,
      modelClassSchemas,
    );

    expect(source).not.toContain('crypto');
    expectToMatchRegexParts(source, [
      'import \\{ Person, type PersonWithAge \\} from "\\./model\\.js";',
    ]);
    expectToMatchRegexParts(source, [
      'export function makePersonWithAge\\(',
      'data: Partial<PersonWithAge> = \\{\\},',
      '\\): PersonWithAge \\{',
      'return new Person\\(\\{',
      'age: 0,',
      'valid: true,',
      'weight: 3,',
      'name: "name",',
      '...data,',
      '\\}\\) as PersonWithAge;',
      'export function makePerson\\(data: Partial<Person> = \\{\\}\\): Person \\{',
      'return new Person\\(\\{',
      'age: null,',
      'name: "name",',
      'valid: false,',
      'weight: 0',
      '...data,',
      '\\}\\);',
    ]);
    expect(generatedSchemas).toEqual({
      [TEST_PATH]: { name: 'makePerson', file: outputFile },
      [CONSTRAINT_PATH]: {
        name: 'makePersonWithAge',
        file: outputFile,
      },
    });
  });
});
