import type {
  ObjectSchema,
  Property,
  PropertyType,
  Schema,
} from '@causa/workspace-core';
import { makeOpenApiDecorators } from './openapi-decorators.js';

function objectSchema(overrides: Partial<ObjectSchema> = {}): ObjectSchema {
  return {
    kind: 'object',
    name: 'Test',
    path: '/test.json',
    extensions: { tsOpenApi: true },
    databases: [],
    additionalProperties: false,
    properties: [],
    ...overrides,
  };
}

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

describe('makeOpenApiDecorators', () => {
  it('should return no decorators when the schema does not opt into OpenAPI', () => {
    const schema = objectSchema({ extensions: {} });

    const actual = makeOpenApiDecorators(schema, undefined, {});

    expect(actual).toBeEmpty();
  });

  it('should return no class decorators when the schema has no object refs', () => {
    const actual = makeOpenApiDecorators(objectSchema(), undefined, {});

    expect(actual).toBeEmpty();
  });

  it('should add @ApiExtraModels for each referenced object class', () => {
    const refPath = '/test.json#/$defs/MyClass';
    const schemas: Record<string, Schema> = {
      [refPath]: {
        kind: 'object',
        name: 'MyClass',
        path: refPath,
        extensions: {},
        databases: [],
        additionalProperties: false,
        properties: [],
      },
    };
    const schema = objectSchema({
      properties: [makeProperty({ kind: 'ref', ref: refPath })],
    });

    const actual = makeOpenApiDecorators(schema, undefined, schemas);

    expect(actual).toEqual([
      {
        source: '@ApiExtraModels(MyClass)',
        imports: { '@nestjs/swagger': ['getSchemaPath', 'ApiExtraModels'] },
      },
    ]);
  });

  it.each<[PropertyType, string]>([
    [{ kind: 'primitive', type: 'string' }, 'required: false, type: "string"'],
    [
      { kind: 'primitive', type: 'integer' },
      'required: false, type: "integer"',
    ],
    [
      { kind: 'primitive', type: 'uuid' },
      'required: false, type: "string", format: "uuid"',
    ],
    [
      { kind: 'primitive', type: 'datetime' },
      'required: false, type: "string", format: "date-time"',
    ],
  ])(
    'should add @ApiProperty for the primitive property %j',
    (type, expected) => {
      const property = makeProperty(type);

      const actual = makeOpenApiDecorators(objectSchema(), property, {}).map(
        (d) => d.source,
      );

      expect(actual).toEqual([`@ApiProperty({ ${expected} })`]);
    },
  );

  it('should include the description when present', () => {
    const property = makeProperty(
      { kind: 'primitive', type: 'string' },
      { description: 'A description' },
    );

    const actual = makeOpenApiDecorators(objectSchema(), property, {}).map(
      (d) => d.source,
    );

    expect(actual).toEqual([
      '@ApiProperty({ description: "A description", required: false, type: "string" })',
    ]);
  });

  it('should wrap nullable types in oneOf', () => {
    const property = makeProperty(
      { kind: 'primitive', type: 'string' },
      { nullable: true },
    );

    const actual = makeOpenApiDecorators(objectSchema(), property, {}).map(
      (d) => d.source,
    );

    expect(actual).toEqual([
      '@ApiProperty({ required: false, oneOf: [{ type: "string" }, { type: "null" }] })',
    ]);
  });

  it('should emit array option with item type for arrays', () => {
    const property = makeProperty({
      kind: 'array',
      items: { kind: 'primitive', type: 'string' },
      itemNullable: false,
    });

    const actual = makeOpenApiDecorators(objectSchema(), property, {}).map(
      (d) => d.source,
    );

    expect(actual).toEqual([
      '@ApiProperty({ required: false, type: "array", items: { type: "string" } })',
    ]);
  });

  it('should resolve refs to enums', () => {
    const enumPath = '/test.json#/$defs/MyEnum';
    const schemas: Record<string, Schema> = {
      [enumPath]: {
        kind: 'enum',
        name: 'MyEnum',
        path: enumPath,
        type: 'string',
        values: ['a', 'b'],
        extensions: {},
      },
    };
    const property = makeProperty({ kind: 'ref', ref: enumPath });

    const actual = makeOpenApiDecorators(objectSchema(), property, schemas).map(
      (d) => d.source,
    );

    expect(actual).toEqual([
      '@ApiProperty({ required: false, type: "string", enum: ["a","b"] })',
    ]);
  });

  it('should emit map types with additionalProperties', () => {
    const property = makeProperty({
      kind: 'map',
      items: { kind: 'primitive', type: 'string' },
    });

    const actual = makeOpenApiDecorators(objectSchema(), property, {}).map(
      (d) => d.source,
    );

    expect(actual).toEqual([
      '@ApiProperty({ selfRequired: false, type: "object", additionalProperties: { type: "string" } })',
    ]);
  });
});
