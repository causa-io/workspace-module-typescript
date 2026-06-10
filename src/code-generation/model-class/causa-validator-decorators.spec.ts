import type { ObjectSchema, Property } from '@causa/workspace-core';
import { makeCausaValidatorDecorators } from './causa-validator-decorators.js';

const SCHEMA: ObjectSchema = {
  kind: 'object',
  name: 'Test',
  path: '/test.json',
  extensions: {},
  databases: [],
  additionalProperties: false,
  properties: [],
};

function makeProperty(overrides: Partial<Property> = {}): Property {
  return {
    name: 'p',
    type: { kind: 'primitive', type: 'string' },
    nullable: false,
    required: true,
    extensions: {},
    ...overrides,
  };
}

describe('makeCausaValidatorDecorators', () => {
  it('should return no decorators when the target is a class', () => {
    const actual = makeCausaValidatorDecorators(SCHEMA, undefined);

    expect(actual).toBeEmpty();
  });

  it('should add @IsNullable() for nullable properties', () => {
    const property = makeProperty({ nullable: true });

    const actual = makeCausaValidatorDecorators(SCHEMA, property);

    expect(actual).toEqual([
      {
        source: '@_CausaRuntimeIsNullable()',
        imports: {
          '@causa/runtime': ['IsNullable as _CausaRuntimeIsNullable'],
        },
      },
    ]);
  });

  it('should add @AllowMissing() for optional properties', () => {
    const property = makeProperty({ required: false });

    const actual = makeCausaValidatorDecorators(SCHEMA, property);

    expect(actual).toEqual([
      {
        source: '@_CausaRuntimeAllowMissing()',
        imports: {
          '@causa/runtime': ['AllowMissing as _CausaRuntimeAllowMissing'],
        },
      },
    ]);
  });

  it('should add both decorators when the property is nullable and optional', () => {
    const property = makeProperty({ nullable: true, required: false });

    const actual = makeCausaValidatorDecorators(SCHEMA, property);

    expect(actual).toIncludeSameMembers([
      {
        source: '@_CausaRuntimeIsNullable()',
        imports: {
          '@causa/runtime': ['IsNullable as _CausaRuntimeIsNullable'],
        },
      },
      {
        source: '@_CausaRuntimeAllowMissing()',
        imports: {
          '@causa/runtime': ['AllowMissing as _CausaRuntimeAllowMissing'],
        },
      },
    ]);
  });

  it('should return no decorators for required non-nullable properties', () => {
    const property = makeProperty();

    const actual = makeCausaValidatorDecorators(SCHEMA, property);

    expect(actual).toBeEmpty();
  });
});
