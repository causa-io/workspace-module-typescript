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
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              description: 'The car ID',
              schema: { $ref: '../schemas/car-id.yaml#/$defs/CarId' },
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
              name: 'filter',
              in: 'query',
              required: false,
              schema: {
                oneOf: [
                  { $ref: '../schemas/filter-a.yaml' },
                  { $ref: '#/$defs/FilterB' },
                  { $ref: '/absolute/filter-c.yaml' },
                  { $ref: 'https://example.com/filter-d.yaml' },
                ],
              },
            },
          ],
        },
      ],
    };

    const result = makeParametersSchemasForSpecification(spec);

    expect(result).toIncludeSameMembers([
      {
        name: 'carList/query',
        schema: expect.toSatisfy((s) => {
          expect(JSON.parse(s)).toEqual({
            title: 'carList-query-params',
            type: 'object',
            description: 'The query parameters for the `carList` operation.',
            additionalProperties: false,
            properties: { limit: { type: 'integer' } },
            required: [],
          });
          return true;
        }),
      },
      {
        name: 'carGet/path',
        schema: expect.toSatisfy((s) => {
          expect(JSON.parse(s)).toEqual({
            title: 'carGet-path-params',
            type: 'object',
            description: 'The path parameters for the `carGet` operation.',
            additionalProperties: false,
            properties: {
              id: {
                description: 'The car ID',
                $ref: '/project/schemas/car-id.yaml#/$defs/CarId',
              },
            },
            required: ['id'],
          });
          return true;
        }),
      },
      {
        name: 'carGet/query',
        schema: expect.toSatisfy((s) => {
          expect(JSON.parse(s)).toEqual({
            title: 'carGet-query-params',
            type: 'object',
            description: 'The query parameters for the `carGet` operation.',
            additionalProperties: false,
            properties: {
              filter: {
                oneOf: [
                  { $ref: '/project/schemas/filter-a.yaml' },
                  { $ref: '#/$defs/FilterB' },
                  { $ref: '/absolute/filter-c.yaml' },
                  { $ref: 'https://example.com/filter-d.yaml' },
                ],
              },
            },
            required: [],
          });
          return true;
        }),
      },
    ]);
  });
});
