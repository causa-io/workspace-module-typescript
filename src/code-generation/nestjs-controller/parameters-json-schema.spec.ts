import { makeParametersSchemasForSpecification } from './parameters-json-schema.js';
import type { ParsedApiSpecification } from './types.js';

describe('makeParametersSchemasForSpecification', () => {
  it('should make parameter schemas for a specification', () => {
    const spec: ParsedApiSpecification = {
      filePath: '/project/api/car.api.yaml',
      title: 'Car API',
      resourceName: 'Car',
      basePath: '/cars',
      operations: [
        {
          operationId: 'carList',
          method: 'get',
          path: '/cars',
          isPublic: false,
          parameters: [
            {
              name: 'limit',
              in: 'query',
              required: false,
              schema: { type: 'integer' },
            },
          ],
        },
        {
          operationId: 'carGet',
          method: 'get',
          path: '/cars/{id}',
          isPublic: false,
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'The car ID',
              schema: { type: 'string', format: 'uuid' },
            },
            {
              name: 'Authorization',
              in: 'header',
              required: true,
              schema: { type: 'string' },
            },
            {
              name: 'session',
              in: 'cookie',
              required: false,
              schema: { type: 'string' },
            },
            {
              name: 'updatedAt',
              in: 'query',
              required: true,
              schema: { type: 'string', format: 'date-time' },
            },
            {
              name: 'tags',
              in: 'query',
              required: false,
              schema: { type: 'array', items: { type: 'string' } },
            },
            {
              name: 'state',
              in: 'query',
              required: false,
              schema: {
                oneOf: [{ $ref: '../entities/car.yaml#/$defs/CarState' }],
              },
            },
            {
              name: 'kind',
              in: 'query',
              required: false,
              schema: { $ref: '../entities/car-kind.yaml' },
            },
            {
              name: 'publisher',
              in: 'query',
              required: false,
              schema: {
                title: 'CarListPublisherFilter',
                type: 'string',
                enum: ['true', 'false'],
              },
            },
          ],
        },
      ],
    };

    const actual = makeParametersSchemasForSpecification(spec);

    expect(actual).toEqual({
      'carList/query': {
        kind: 'object',
        name: 'carList-query-params',
        path: 'carList/query',
        description: 'The query parameters for the `carList` operation.',
        extensions: {},
        databases: [],
        additionalProperties: false,
        properties: [
          {
            name: 'limit',
            type: { kind: 'primitive', type: 'integer' },
            nullable: false,
            required: false,
            description: undefined,
            extensions: {},
          },
        ],
      },
      'carGet/path': {
        kind: 'object',
        name: 'carGet-path-params',
        path: 'carGet/path',
        description: 'The path parameters for the `carGet` operation.',
        extensions: {},
        databases: [],
        additionalProperties: false,
        properties: [
          {
            name: 'id',
            type: { kind: 'primitive', type: 'uuid' },
            nullable: false,
            required: true,
            description: 'The car ID',
            extensions: {},
          },
        ],
      },
      'carGet/query': {
        kind: 'object',
        name: 'carGet-query-params',
        path: 'carGet/query',
        description: 'The query parameters for the `carGet` operation.',
        extensions: {},
        databases: [],
        additionalProperties: false,
        properties: [
          {
            name: 'updatedAt',
            type: { kind: 'primitive', type: 'datetime' },
            nullable: false,
            required: true,
            description: undefined,
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
            required: false,
            description: undefined,
            extensions: {},
          },
          {
            name: 'state',
            type: {
              kind: 'ref',
              ref: '/project/entities/car.yaml#/$defs/CarState',
            },
            nullable: false,
            required: false,
            description: undefined,
            extensions: {},
          },
          {
            name: 'kind',
            type: { kind: 'ref', ref: '/project/entities/car-kind.yaml' },
            nullable: false,
            required: false,
            description: undefined,
            extensions: {},
          },
          {
            name: 'publisher',
            type: {
              kind: 'ref',
              ref: '/project/api/car.api.yaml#/inlineEnums/CarListPublisherFilter',
            },
            nullable: false,
            required: false,
            description: undefined,
            extensions: {},
          },
        ],
      },
      '/project/api/car.api.yaml#/inlineEnums/CarListPublisherFilter': {
        kind: 'enum',
        type: 'string',
        name: 'CarListPublisherFilter',
        path: '/project/api/car.api.yaml#/inlineEnums/CarListPublisherFilter',
        extensions: {},
        values: ['true', 'false'],
      },
    });
  });
});
