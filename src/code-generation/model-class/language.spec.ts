// This file tests the language, but also the underlying renderer, by actually using the language with quicktype.

import type { WorkspaceContext } from '@causa/workspace';
import { createContext } from '@causa/workspace/testing';
import { mkdtemp, rm } from 'fs/promises';
import 'jest-extended';
import { tmpdir } from 'os';
import { join } from 'path';
import type { TypeScriptDecorator } from '../decorator.js';
import {
  type ClassContext,
  type ClassPropertyContext,
  TypeScriptWithDecoratorsRenderer,
} from '../renderer.js';
import { expectToMatchRegexParts, generateFromSchema } from '../utils.test.js';
import { TypeScriptModelClassTargetLanguage } from './language.js';
import type { TypeScriptModelClassOptions } from './options.js';

const SCHEMA = {
  title: 'MyClass',
  type: 'object',
  description: '📚\n💡',
  additionalProperties: false,
  causa: {
    tsExcludedDecorators: ['ExcludedDecorator'],
    tsDecorators: [
      {
        source: '@ClassDecorator()',
        imports: { 'my-module': ['ClassDecorator'] },
      },
    ],
  },
  properties: {
    myProperty: {
      type: 'string',
      description: '🎉',
      causa: {
        tsDecorators: [
          {
            source: '@MyDecorator()',
            imports: { 'my-module': ['MyDecorator'] },
          },
        ],
      },
    },
    myDate: {
      type: 'string',
      format: 'date-time',
      description: '📅',
    },
    nullableProperty: {
      oneOf: [{ type: 'string' }, { type: 'null' }],
    },
    myBigInt: {
      type: 'integer',
      causa: { tsType: 'bigint' },
    },
    myDefaultRequiredProperty: {
      type: 'string',
      causa: { tsDefault: '"💮"' },
    },
    myOtherDefaultProperty: {
      type: 'string',
      causa: { tsDefault: '"🤷"' },
    },
    myChildClass: {
      oneOf: [
        {
          title: 'MyChildClass',
          type: 'object',
          additionalProperties: false,
          causa: {
            tsExcludedDecorators: ['ExcludedDecorator'],
          },
          properties: {
            myChildProperty: {
              type: 'string',
            },
          },
          required: ['myChildProperty'],
        },
        { type: 'null' },
      ],
    },
    myEnum: {
      oneOf: [{ $ref: '#/$defs/MyEnum' }],
    },
    myEnumHint: {
      type: 'string',
      causa: { enumHint: '#/$defs/MyEnum' },
    },
    myConst: {
      type: 'string',
      const: 'a',
    },
    myOtherEnum: {
      oneOf: [{ $ref: '#/$defs/MyOtherEnum' }],
    },
    // This makes no sense, and is only used to ensure `MyClassWithNullConstraint` is generated.
    // If not referenced, it would not be generated because it is not at the top level.
    dummyRefToConstraint: {
      oneOf: [{ $ref: '#/$defs/MyClassWithNullConstraint' }],
    },
  },
  required: ['myProperty', 'myDefaultRequiredProperty'],
  $defs: {
    MyEnum: {
      type: 'string',
      enum: ['a', 'b', 'c'],
    },
    MyOtherEnum: {
      title: 'MyOtherEnum',
      type: 'string',
      enum: ['b'],
    },
    MyClassWithNullConstraint: {
      title: 'MyClassWithNullConstraint',
      type: 'object',
      description: '🗜️',
      additionalProperties: false,
      causa: {
        tsExcludedDecorators: ['ExcludedDecorator'],
        constraintFor: '#',
      },
      properties: {
        nullableProperty: { type: 'null' },
      },
    },
  },
};

class MyDecoratorRenderer extends TypeScriptWithDecoratorsRenderer<TypeScriptModelClassOptions> {
  decoratorsForClass(context: ClassContext): TypeScriptDecorator[] {
    const decorators: TypeScriptDecorator[] = [];
    this.addDecoratorToList(
      decorators,
      context,
      'OtherDecorator',
      'some-module',
      `@OtherDecorator(${this.targetLanguage.options.generatorOptions?.myArg ?? ''})`,
    );
    this.addDecoratorToList(
      decorators,
      context,
      'ExcludedDecorator',
      'some-module',
      '@ExcludedDecorator()',
    );
    return decorators;
  }

  decoratorsForProperty(context: ClassPropertyContext): TypeScriptDecorator[] {
    if (context.jsonName !== 'nullableProperty') {
      return [];
    }

    return [{ source: '@Nullable()', imports: {} }];
  }
}

describe('TypeScriptModelClassLanguage', () => {
  let tmpDir: string;
  let outputFile: string;
  let context: WorkspaceContext;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'causa-test-'));
    outputFile = join(tmpDir, 'test-output.ts');
    ({ context } = createContext());
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should generate a class with properties and decorators', async () => {
    const language = new TypeScriptModelClassTargetLanguage(
      outputFile,
      context,
      { decoratorRenderers: [MyDecoratorRenderer] },
    );

    const actualCode = await generateFromSchema(language, SCHEMA, outputFile);

    expectToMatchRegexParts(actualCode, [
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
    expectToMatchRegexParts(actualCode, [
      'export enum MyEnum\\s+\\{',
      'A = "a",',
      'B = "b",',
      'C = "c",',
      '\\}',
    ]);
    expectToMatchRegexParts(actualCode, [
      '🎉',
      '@MyDecorator\\(\\)\\n\\s+readonly myProperty!: string;',
    ]);
    expectToMatchRegexParts(actualCode, ['📅', 'readonly myDate\\?: Date;']);
    expectToMatchRegexParts(actualCode, [
      '@Nullable\\(\\)\\n\\s+readonly nullableProperty\\?: (null \\| string|string \\| null);',
    ]);
    expectToMatchRegexParts(actualCode, ['readonly myBigInt\\?: bigint;']);
    expectToMatchRegexParts(actualCode, [
      `readonly myDefaultRequiredProperty: string =\\s*["']💮["'];`,
    ]);
    expectToMatchRegexParts(actualCode, [
      `readonly myOtherDefaultProperty: string =\\s*["']🤷["'];`,
    ]);
    expectToMatchRegexParts(actualCode, [
      'readonly myChildClass\\?: (MyChildClass \\| null|null \\| MyChildClass);',
    ]);
    expectToMatchRegexParts(actualCode, ['readonly myEnum\\?: MyEnum;']);
    expectToMatchRegexParts(actualCode, [
      'readonly myEnumHint\\?: string \\| MyEnum;',
    ]);
    expectToMatchRegexParts(actualCode, ['readonly myConst\\?: "a";']);
    expectToMatchRegexParts(actualCode, [
      'readonly myOtherEnum\\?: MyOtherEnum;',
    ]);
    expectToMatchRegexParts(actualCode, [
      '🗜️',
      'export type MyClassWithNull = MyClass & MyClassWithNullConstraint;',
      '🗜️',
      'export class MyClassWithNullConstraint\\s+\\{',
      'readonly nullableProperty\\?: null;',
      '\\}',
    ]);
    expect(actualCode).not.toContain('@ExcludedDecorator()');
    expect(actualCode).not.toContain('enum MyConst');

    expect(language.generatedSchemas).toEqual({
      'test.json': { name: 'MyClass', file: outputFile },
      'test.json#/$defs/MyEnum': { name: 'MyEnum', file: outputFile },
      'test.json#/$defs/MyOtherEnum': { name: 'MyOtherEnum', file: outputFile },
      'test.json#/properties/myChildClass/oneOf/0': {
        name: 'MyChildClass',
        file: outputFile,
      },
      'test.json#/$defs/MyClassWithNullConstraint': {
        name: 'MyClassWithNull',
        file: outputFile,
      },
    });
  });

  it('should support custom constraint suffix', async () => {
    const customSchema = {
      title: 'MyClass',
      type: 'object',
      additionalProperties: false,
      properties: {
        dummyRefToRule: { oneOf: [{ $ref: '#/$defs/MyClassWithNullRule' }] },
      },
      $defs: {
        MyClassWithNullRule: {
          title: 'MyClassWithNullRule',
          type: 'object',
          description: '🗜️',
          additionalProperties: false,
          causa: { constraintFor: '#' },
          properties: { nullableProperty: { type: 'null' } },
        },
      },
    };
    const language = new TypeScriptModelClassTargetLanguage(
      outputFile,
      context,
      { generatorOptions: { constraintSuffix: 'Rule' } },
    );

    const actualCode = await generateFromSchema(
      language,
      customSchema,
      outputFile,
    );

    expectToMatchRegexParts(actualCode, [
      'export type MyClassWithNull = MyClass & MyClassWithNullRule;',
      'export class MyClassWithNullRule',
    ]);
    expect(language.generatedSchemas).toEqual({
      'test.json': { name: 'MyClass', file: outputFile },
      'test.json#/$defs/MyClassWithNullRule': {
        name: 'MyClassWithNull',
        file: outputFile,
      },
    });
  });

  it('should enforce options', async () => {
    const language = new TypeScriptModelClassTargetLanguage(
      outputFile,
      context,
      {
        readonlyProperties: false,
        assignConstructor: false,
        nonNullAssertionOnProperties: false,
        leadingComment: '🚨 Very important',
        decoratorRenderers: [MyDecoratorRenderer],
        generatorOptions: { myArg: 'true' },
      },
    );

    const actualCode = await generateFromSchema(language, SCHEMA, outputFile);

    expect(actualCode).toStartWith('// 🚨 Very important');
    expect(actualCode).not.toContain('readonly');
    expect(actualCode).not.toContain('!');
    expect(actualCode).not.toContain('constructor');
    expect(actualCode).toContain('@OtherDecorator(true)');
  });
});
