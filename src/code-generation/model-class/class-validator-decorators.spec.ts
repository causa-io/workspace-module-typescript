import type {
  ObjectSchema,
  Property,
  PropertyType,
  Schema,
} from '@causa/workspace-core';
import { makeClassValidatorDecorators } from './class-validator-decorators.js';

const SCHEMA: ObjectSchema = {
  kind: 'object',
  name: 'Test',
  path: '/test.json',
  extensions: {},
  databases: [],
  properties: [],
};

function makeProperty(
  type: PropertyType,
  overrides: Partial<Property> = {},
): Property {
  return {
    name: 'p',
    type,
    nullable: false,
    required: false,
    extensions: {},
    ...overrides,
  };
}

describe('makeClassValidatorDecorators', () => {
  it('should return no decorators when the target is a class', () => {
    const actual = makeClassValidatorDecorators(SCHEMA, undefined, {});

    expect(actual).toBeEmpty();
  });

  it('should return no decorators when tsType is set on the property', () => {
    const property = makeProperty(
      { kind: 'primitive', type: 'integer' },
      { extensions: { tsType: 'bigint' } },
    );

    const actual = makeClassValidatorDecorators(SCHEMA, property, {});

    expect(actual).toBeEmpty();
  });

  it('should add @Equals(null) for null properties', () => {
    const property = makeProperty({ kind: 'null' });

    const actual = makeClassValidatorDecorators(SCHEMA, property, {}).map(
      (d) => d.source,
    );

    expect(actual).toEqual(['@Equals(null)']);
  });

  it.each<[PropertyType, string]>([
    [
      { kind: 'const', type: 'string', value: 'fixedValue' },
      '@Equals("fixedValue")',
    ],
    [{ kind: 'const', type: 'boolean', value: true }, '@Equals(true)'],
    [{ kind: 'const', type: 'integer', value: 42 }, '@Equals(42)'],
  ])('should add @Equals for const properties (%j)', (type, expected) => {
    const property = makeProperty(type);

    const actual = makeClassValidatorDecorators(SCHEMA, property, {}).map(
      (d) => d.source,
    );

    expect(actual).toEqual([expected]);
  });

  it.each<[PropertyType, string]>([
    [{ kind: 'primitive', type: 'string' }, '@IsString()'],
    [{ kind: 'primitive', type: 'integer' }, '@IsInt()'],
    [{ kind: 'primitive', type: 'number' }, '@IsNumber()'],
    [{ kind: 'primitive', type: 'boolean' }, '@IsBoolean()'],
  ])(
    'should add the corresponding decorator for primitive %j',
    (type, expected) => {
      const property = makeProperty(type);

      const actual = makeClassValidatorDecorators(SCHEMA, property, {}).map(
        (d) => d.source,
      );

      expect(actual).toEqual([expected]);
    },
  );

  it('should add @IsUUID(undefined) for uuid', () => {
    const property = makeProperty({ kind: 'primitive', type: 'uuid' });

    const actual = makeClassValidatorDecorators(SCHEMA, property, {}).map(
      (d) => d.source,
    );

    expect(actual).toEqual(['@IsUUID(undefined)']);
  });

  it('should add @IsDate and @Type(() => Date) for datetime', () => {
    const property = makeProperty({ kind: 'primitive', type: 'datetime' });

    const actual = makeClassValidatorDecorators(SCHEMA, property, {}).map(
      (d) => d.source,
    );

    expect(actual).toIncludeSameMembers(['@IsDate()', '@Type(() => Date)']);
  });

  it('should resolve refs to enums and add @IsIn with the enum values', () => {
    const enumPath = '/test.json#/$defs/MyEnum';
    const schemas: Record<string, Schema> = {
      [enumPath]: {
        kind: 'enum',
        name: 'MyEnum',
        path: enumPath,
        type: 'string',
        values: ['a', 'b', 'c'],
        extensions: {},
      },
    };
    const property = makeProperty({ kind: 'ref', ref: enumPath });

    const actual = makeClassValidatorDecorators(SCHEMA, property, schemas).map(
      (d) => d.source,
    );

    expect(actual).toEqual(['@IsIn(["a","b","c"])']);
  });

  it('should add nested-object decorators when the ref resolves to an object', () => {
    const objectPath = '/test.json#/$defs/MyClass';
    const schemas: Record<string, Schema> = {
      [objectPath]: {
        kind: 'object',
        name: 'MyClass',
        path: objectPath,
        extensions: {},
        databases: [],
        properties: [],
      },
    };
    const property = makeProperty(
      { kind: 'ref', ref: objectPath },
      { required: true },
    );

    const actual = makeClassValidatorDecorators(SCHEMA, property, schemas).map(
      (d) => d.source,
    );

    expect(actual).toEqual([
      '@IsObject()',
      '@ValidateNested()',
      '@IsDefined()',
      '@Type(() => MyClass)',
    ]);
  });

  it('should add @IsObject for map types', () => {
    const property = makeProperty({
      kind: 'map',
      items: { kind: 'primitive', type: 'string' },
    });

    const actual = makeClassValidatorDecorators(SCHEMA, property, {}).map(
      (d) => d.source,
    );

    expect(actual).toEqual(['@IsObject()']);
  });

  it('should add @IsArray and the array variant of the item validator', () => {
    const property = makeProperty({
      kind: 'array',
      items: { kind: 'primitive', type: 'uuid' },
      itemNullable: false,
    });

    const actual = makeClassValidatorDecorators(SCHEMA, property, {}).map(
      (d) => d.source,
    );

    expect(actual).toEqual([
      '@IsArray()',
      '@IsUUID(undefined, { each: true })',
    ]);
  });
});
