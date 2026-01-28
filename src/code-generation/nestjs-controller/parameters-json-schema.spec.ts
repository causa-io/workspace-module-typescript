import { makeParametersSchemasForOperations } from './parameters-json-schema.js';
import type { ParsedOperation } from './types.js';

describe('makeParametersSchemasForOperations', () => {
  it('should return empty array when no path or query params', () => {
    const operations: ParsedOperation[] = [
      {
        operationId: 'postCreate',
        method: 'post',
        path: '/posts',
        parameters: [],
      },
    ];

    const result = makeParametersSchemasForOperations(operations);

    expect(result).toEqual([]);
  });

  it('should synthesize path params schema', () => {
    const operations: ParsedOperation[] = [
      {
        operationId: 'postGet',
        method: 'get',
        path: '/posts/{id}',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            description: 'The post ID',
            schema: { type: 'string', format: 'uuid' },
          },
        ],
      },
    ];

    const result = makeParametersSchemasForOperations(operations);

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('postGet/path');

    const schema = JSON.parse(result[0].schema!);
    expect(schema.title).toEqual('postGet-path-params');
    expect(schema.type).toEqual('object');
    expect(schema.additionalProperties).toEqual(false);
    expect(schema.properties.id).toEqual({
      type: 'string',
      format: 'uuid',
      description: 'The post ID',
    });
    expect(schema.required).toEqual(['id']);
  });

  it('should synthesize query params schema', () => {
    const operations: ParsedOperation[] = [
      {
        operationId: 'postList',
        method: 'get',
        path: '/posts',
        parameters: [
          {
            name: 'limit',
            in: 'query',
            required: false,
            schema: { type: 'integer', minimum: 1, maximum: 100 },
          },
          {
            name: 'offset',
            in: 'query',
            required: false,
            schema: { type: 'integer' },
          },
        ],
      },
    ];

    const result = makeParametersSchemasForOperations(operations);

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('postList/query');

    const schema = JSON.parse(result[0].schema!);
    expect(schema.properties.limit).toEqual({
      type: 'integer',
      minimum: 1,
      maximum: 100,
    });
    expect(schema.properties.offset).toEqual({ type: 'integer' });
    expect(schema.required).toEqual([]);
  });

  it('should synthesize both path and query params schemas', () => {
    const operations: ParsedOperation[] = [
      {
        operationId: 'postUpdate',
        method: 'patch',
        path: '/posts/{id}',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
          {
            name: 'updatedAt',
            in: 'query',
            required: true,
            schema: { type: 'string', format: 'date-time' },
          },
        ],
      },
    ];

    const result = makeParametersSchemasForOperations(operations);

    expect(result).toHaveLength(2);
    expect(result[0].name).toEqual('postUpdate/path');
    expect(result[1].name).toEqual('postUpdate/query');

    const pathSchema = JSON.parse(result[0].schema!);
    expect(pathSchema.properties.id.format).toEqual('uuid');

    const querySchema = JSON.parse(result[1].schema!);
    expect(querySchema.properties.updatedAt.format).toEqual('date-time');
    expect(querySchema.required).toEqual(['updatedAt']);
  });

  it('should ignore header and cookie parameters', () => {
    const operations: ParsedOperation[] = [
      {
        operationId: 'postGet',
        method: 'get',
        path: '/posts/{id}',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
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
        ],
      },
    ];

    const result = makeParametersSchemasForOperations(operations);

    expect(result).toHaveLength(1);
    expect(result[0].name).toEqual('postGet/path');

    const schema = JSON.parse(result[0].schema!);
    expect(Object.keys(schema.properties)).toEqual(['id']);
  });

  it('should synthesize schemas for multiple operations', () => {
    const operations: ParsedOperation[] = [
      {
        operationId: 'postList',
        method: 'get',
        path: '/posts',
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
        operationId: 'postGet',
        method: 'get',
        path: '/posts/{id}',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
      },
    ];

    const result = makeParametersSchemasForOperations(operations);

    expect(result).toHaveLength(2);
    expect(result.map((s) => s.name)).toEqual([
      'postList/query',
      'postGet/path',
    ]);
  });
});
