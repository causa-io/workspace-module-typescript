// This file tests the language, but also the underlying renderer, by actually using the language with quicktype.

import { mkdtemp, rm } from 'fs/promises';
import 'jest-extended';
import { tmpdir } from 'os';
import { join } from 'path';
import { pino } from 'pino';
import type { TypeScriptDecorator } from './decorator.js';
import { TypeScriptWithDecoratorsTargetLanguage } from './language.js';
import {
  type ClassContext,
  type ClassPropertyContext,
  TypeScriptDecoratorsRenderer,
} from './ts-decorators-renderer.js';
import { expectToMatchRegexParts, generateFromSchema } from './utils.test.js';

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
  },
  required: ['myProperty', 'myDefaultRequiredProperty'],
  $defs: {
    MyEnum: {
      type: 'string',
      enum: ['a', 'b', 'c'],
    },
  },
};

class MyDecoratorRenderer extends TypeScriptDecoratorsRenderer {
  decoratorsForClass(context: ClassContext): TypeScriptDecorator[] {
    const decorators: TypeScriptDecorator[] = [];
    this.addDecoratorToList(
      decorators,
      context,
      'OtherDecorator',
      'some-module',
      `@OtherDecorator(${this.decoratorOptions.myArg ?? ''})`,
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

describe('TypeScriptWithDecoratorsTargetLanguage', () => {
  let tmpDir: string;
  let outputFile: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'causa-test-'));
    outputFile = join(tmpDir, 'test-output.ts');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should generate a class with properties and decorators', async () => {
    const language = new TypeScriptWithDecoratorsTargetLanguage(
      outputFile,
      pino(),
      { decoratorRenderers: [MyDecoratorRenderer] },
    );

    const actualCode = await generateFromSchema(language, SCHEMA, outputFile);

    expectToMatchRegexParts(actualCode, [
      `import { ClassDecorator, MyDecorator } from ['"]my-module['"];`,
      'export class MyChildClass\\s+{',
      '}',
      '📚\\n.*💡',
      '@ClassDecorator\\(\\)',
      '@OtherDecorator\\(\\)',
      'export class MyClass\\s+{',
      'constructor\\(init: MyClass\\) {',
      'Object.assign\\(this, init\\);',
      '}',
      '}',
    ]);
    expectToMatchRegexParts(actualCode, [
      'export enum MyEnum\\s+{',
      'A = "a",',
      'B = "b",',
      'C = "c",',
      '}',
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
    expect(actualCode).not.toContain('@ExcludedDecorator()');
  });

  it('should enforce options', async () => {
    const language = new TypeScriptWithDecoratorsTargetLanguage(
      outputFile,
      pino(),
      {
        readonlyProperties: false,
        assignConstructor: false,
        nonNullAssertionOnProperties: false,
        leadingComment: '🚨 Very important',
        decoratorRenderers: [MyDecoratorRenderer],
        decoratorOptions: { myArg: 'true' },
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
