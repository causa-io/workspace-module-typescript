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
  additionalProperties: false,
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

    expect(actual).toEqual(['@_ClassValidatorEquals(null)']);
  });

  it.each<[PropertyType, string]>([
    [
      { kind: 'const', type: 'string', value: 'fixedValue' },
      '@_ClassValidatorEquals("fixedValue")',
    ],
    [
      { kind: 'const', type: 'boolean', value: true },
      '@_ClassValidatorEquals(true)',
    ],
    [
      { kind: 'const', type: 'integer', value: 42 },
      '@_ClassValidatorEquals(42)',
    ],
  ])('should add @Equals for const properties (%j)', (type, expected) => {
    const property = makeProperty(type);

    const actual = makeClassValidatorDecorators(SCHEMA, property, {}).map(
      (d) => d.source,
    );

    expect(actual).toEqual([expected]);
  });

  it.each<[PropertyType, string]>([
    [{ kind: 'primitive', type: 'string' }, '@_ClassValidatorIsString()'],
    [{ kind: 'primitive', type: 'integer' }, '@_ClassValidatorIsInt()'],
    [{ kind: 'primitive', type: 'number' }, '@_ClassValidatorIsNumber()'],
    [{ kind: 'primitive', type: 'boolean' }, '@_ClassValidatorIsBoolean()'],
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

    expect(actual).toEqual(['@_ClassValidatorIsUuid(undefined)']);
  });

  it('should add @IsDate and @Type(() => Date) for datetime', () => {
    const property = makeProperty({ kind: 'primitive', type: 'datetime' });

    const actual = makeClassValidatorDecorators(SCHEMA, property, {}).map(
      (d) => d.source,
    );

    expect(actual).toIncludeSameMembers([
      '@_ClassValidatorIsDate()',
      '@_ClassTransformerType(() => Date)',
    ]);
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

    expect(actual).toEqual(['@_ClassValidatorIsIn(["a","b","c"])']);
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
        additionalProperties: false,
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
      '@_ClassValidatorIsObject()',
      '@_ClassValidatorValidateNested()',
      '@_ClassValidatorIsDefined()',
      '@_ClassTransformerType(() => MyClass)',
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

    expect(actual).toEqual(['@_ClassValidatorIsObject()']);
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
      '@_ClassValidatorIsArray()',
      '@_ClassValidatorIsUuid(undefined, { each: true })',
    ]);
  });

  it('should add @IsArray() and @IsArray({ each: true }) for nested arrays', () => {
    const property = makeProperty({
      kind: 'array',
      items: {
        kind: 'array',
        items: { kind: 'primitive', type: 'string' },
        itemNullable: false,
      },
      itemNullable: false,
    });

    const actual = makeClassValidatorDecorators(SCHEMA, property, {}).map(
      (d) => d.source,
    );

    expect(actual).toEqual([
      '@_ClassValidatorIsArray()',
      '@_ClassValidatorIsArray({ each: true })',
    ]);
  });

  it('should add @IsArray and @Equals(null, { each: true }) for arrays of null', () => {
    const property = makeProperty({
      kind: 'array',
      items: { kind: 'null' },
      itemNullable: false,
    });

    const actual = makeClassValidatorDecorators(SCHEMA, property, {}).map(
      (d) => d.source,
    );

    expect(actual).toEqual([
      '@_ClassValidatorIsArray()',
      '@_ClassValidatorEquals(null, { each: true })',
    ]);
  });

  it('should add @Allow() fallback when no validator applies, only for required and non-nullable properties', () => {
    // A ref to a union schema has no entry in the validator map, so the validators list ends up empty.
    const UNION_PATH = '/test.json#/$defs/MyUnion';
    const type: PropertyType = { kind: 'ref', ref: UNION_PATH };
    const schemas: Record<string, Schema> = {
      [UNION_PATH]: {
        kind: 'union',
        combiner: 'oneOf',
        name: 'MyUnion',
        path: UNION_PATH,
        extensions: {},
        types: [
          { kind: 'primitive', type: 'string' },
          { kind: 'primitive', type: 'integer' },
        ],
      },
    };

    const requiredNonNullable = makeClassValidatorDecorators(
      SCHEMA,
      makeProperty(type, { required: true, nullable: false }),
      schemas,
    ).map((d) => d.source);
    expect(requiredNonNullable).toEqual(['@_ClassValidatorAllow()']);

    const optional = makeClassValidatorDecorators(
      SCHEMA,
      makeProperty(type, { required: false, nullable: false }),
      schemas,
    );
    expect(optional).toBeEmpty();

    const nullable = makeClassValidatorDecorators(
      SCHEMA,
      makeProperty(type, { required: true, nullable: true }),
      schemas,
    );
    expect(nullable).toBeEmpty();
  });
});
