import type {
  ObjectSchema,
  Property,
  PropertyType,
} from '@causa/workspace-core';
import { makePrimitiveTypeTransformerDecorators } from './primitive-type-transformer-decorators.js';

const SCHEMA: ObjectSchema = {
  kind: 'object',
  name: 'Test',
  path: '/test.json',
  extensions: {},
  databases: [],
  properties: [],
};

function makeProperty(type: PropertyType): Property {
  return {
    name: 'p',
    type,
    nullable: false,
    required: false,
    extensions: {},
  };
}

describe('makePrimitiveTypeTransformerDecorators', () => {
  it('should return no decorators when the target is a class', () => {
    const actual = makePrimitiveTypeTransformerDecorators(SCHEMA, undefined);

    expect(actual).toBeEmpty();
  });

  it.each<[PropertyType, string]>([
    [{ kind: 'primitive', type: 'integer' }, '@Type(() => Number)'],
    [{ kind: 'primitive', type: 'number' }, '@Type(() => Number)'],
    [{ kind: 'primitive', type: 'boolean' }, '@Type(() => Boolean)'],
  ])(
    'should add the constructor-based @Type for primitive %j',
    (type, expected) => {
      const property = makeProperty(type);

      const actual = makePrimitiveTypeTransformerDecorators(
        SCHEMA,
        property,
      ).map((d) => d.source);

      expect(actual).toEqual([expected]);
    },
  );

  it.each<PropertyType>([
    { kind: 'primitive', type: 'string' },
    { kind: 'primitive', type: 'uuid' },
    { kind: 'primitive', type: 'datetime' },
  ])('should not add decorators for string-like primitive %j', (type) => {
    const property = makeProperty(type);

    const actual = makePrimitiveTypeTransformerDecorators(SCHEMA, property);

    expect(actual).toBeEmpty();
  });

  it('should unwrap array items', () => {
    const property = makeProperty({
      kind: 'array',
      items: { kind: 'primitive', type: 'integer' },
      itemNullable: false,
    });

    const actual = makePrimitiveTypeTransformerDecorators(SCHEMA, property).map(
      (d) => d.source,
    );

    expect(actual).toEqual(['@Type(() => Number)']);
  });

  it.each<PropertyType>([
    { kind: 'ref', ref: '/other.json' },
    { kind: 'null' },
  ])('should not add decorators for non-primitive type %j', (type) => {
    const property = makeProperty(type);

    const actual = makePrimitiveTypeTransformerDecorators(SCHEMA, property);

    expect(actual).toBeEmpty();
  });
});
