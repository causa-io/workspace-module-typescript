import {
  synthesizeSchemasForOperation,
  synthesizeSchemasForOperations,
} from './schema-synthesizer.js';
import type { ParsedOperation } from './types.js';

describe('schema-synthesizer', () => {
  describe('synthesizeSchemasForOperation', () => {
    it('should return empty array when no path or query params', () => {
      const operation: ParsedOperation = {
        operationId: 'postCreate',
        method: 'post',
        path: '/posts',
        parameters: [],
        responses: [],
      };

      const result = synthesizeSchemasForOperation(operation);

      expect(result).toEqual([]);
    });

    it('should synthesize path params schema', () => {
      const operation: ParsedOperation = {
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
        responses: [],
      };

      const result = synthesizeSchemasForOperation(operation);

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
      const operation: ParsedOperation = {
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
        responses: [],
      };

      const result = synthesizeSchemasForOperation(operation);

      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('postList/query');

      const schema = JSON.parse(result[0].schema);
      expect(schema.properties.limit).toEqual({
        type: 'integer',
        minimum: 1,
        maximum: 100,
      });
      expect(schema.properties.offset).toEqual({ type: 'integer' });
      expect(schema.required).toEqual([]);
    });

    it('should synthesize both path and query params schemas', () => {
      const operation: ParsedOperation = {
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
        responses: [],
      };

      const result = synthesizeSchemasForOperation(operation);

      expect(result).toHaveLength(2);
      expect(result[0].name).toEqual('postUpdate/path');
      expect(result[1].name).toEqual('postUpdate/query');

      const pathSchema = JSON.parse(result[0].schema);
      expect(pathSchema.properties.id.format).toEqual('uuid');

      const querySchema = JSON.parse(result[1].schema);
      expect(querySchema.properties.updatedAt.format).toEqual('date-time');
      expect(querySchema.required).toEqual(['updatedAt']);
    });

    it('should synthesize header params schema', () => {
      const operation: ParsedOperation = {
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
            name: 'X-Custom-Header',
            in: 'header',
            required: true,
            schema: { type: 'string' },
          },
        ],
        responses: [],
      };

      const result = synthesizeSchemasForOperation(operation);

      expect(result).toHaveLength(2);
      expect(result[0].name).toEqual('postGet/path');
      expect(result[1].name).toEqual('postGet/header');

      const headerSchema = JSON.parse(result[1].schema!);
      expect(headerSchema.title).toEqual('postGet-header-params');
      expect(headerSchema.properties['X-Custom-Header']).toEqual({
        type: 'string',
      });
      expect(headerSchema.required).toEqual(['X-Custom-Header']);
    });

    it('should ignore cookie parameters', () => {
      const operation: ParsedOperation = {
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
            name: 'session',
            in: 'cookie',
            required: false,
            schema: { type: 'string' },
          },
        ],
        responses: [],
      };

      const result = synthesizeSchemasForOperation(operation);

      expect(result).toHaveLength(1);
      expect(result[0].name).toEqual('postGet/path');

      const schema = JSON.parse(result[0].schema);
      expect(Object.keys(schema.properties)).toEqual(['id']);
    });
  });

  describe('synthesizeSchemasForOperations', () => {
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
          responses: [],
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
          responses: [],
        },
      ];

      const result = synthesizeSchemasForOperations(operations);

      expect(result).toHaveLength(2);
      expect(result.map((s) => s.name)).toEqual([
        'postList/query',
        'postGet/path',
      ]);
    });
  });
});
