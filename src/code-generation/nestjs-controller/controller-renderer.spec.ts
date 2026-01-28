import type { GeneratedSchemas } from '@causa/workspace-core';
import type { ParsedApiSpec } from './openapi-parser.js';
import {
  buildControllerFileName,
  renderControllerFile,
  toKebabCase,
} from './controller-renderer.js';

describe('controller-renderer', () => {
  describe('toKebabCase', () => {
    it('should convert PascalCase to kebab-case', () => {
      expect(toKebabCase('Post')).toEqual('post');
      expect(toKebabCase('PostImportJob')).toEqual('post-import-job');
      expect(toKebabCase('CompanyMember')).toEqual('company-member');
    });

    it('should handle consecutive capitals', () => {
      expect(toKebabCase('HTMLParser')).toEqual('html-parser');
      expect(toKebabCase('APIController')).toEqual('api-controller');
    });
  });

  describe('buildControllerFileName', () => {
    it('should build kebab-case file name with .api.controller.ts suffix', () => {
      expect(buildControllerFileName('Post')).toEqual('post.api.controller.ts');
      expect(buildControllerFileName('PostImportJob')).toEqual(
        'post-import-job.api.controller.ts',
      );
    });
  });

  describe('renderControllerFile', () => {
    const modelClassSchemas: GeneratedSchemas = {
      '/project/entities/post.yaml': {
        name: 'Post',
        file: '/project/service/src/model/generated.ts',
      },
      '/project/api/dtos/post-create.dto.yaml': {
        name: 'PostCreateDto',
        file: '/project/service/src/model/generated.ts',
      },
    };

    it('should render a simple controller with one operation', () => {
      const apiSpec: ParsedApiSpec = {
        filePath: '/project/api/post.api.yaml',
        title: 'Post API',
        resourceName: 'Post',
        basePath: '/posts',
        operations: [
          {
            operationId: 'postGet',
            method: 'get',
            path: '/posts/{id}',
            summary: 'Gets a post by ID.',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string', format: 'uuid' },
              },
            ],
            responses: [
              {
                statusCode: '200',
                description: 'Success',
                schemaRef: '../entities/post.yaml',
              },
            ],
          },
        ],
      };

      const result = renderControllerFile(
        apiSpec,
        modelClassSchemas,
        '/project/service/src/api/post.api.controller.ts',
        '/project/service/src/api/model.ts',
        '/project/service/src/model/generated.ts',
      );

      // Check imports
      expect(result).toContain("from '@nestjs/common'");
      expect(result).toContain('Controller');
      expect(result).toContain('Get');
      expect(result).toContain('HttpCode');
      expect(result).toContain('HttpStatus');
      expect(result).toContain('Param');
      expect(result).toContain('Type');

      // Check param imports
      expect(result).toContain("from './model.js'");
      expect(result).toContain('PostGetPathParams');

      // Check external type imports
      expect(result).toContain("from '../model/generated.js'");
      expect(result).toContain('Post');

      // Check interface
      expect(result).toContain('export interface PostApiContract');
      expect(result).toContain('get(');
      expect(result).toContain('params: PostGetPathParams');
      expect(result).toContain('...rest: any[]');
      expect(result).toContain('): Promise<Post>');

      // Check decorator factory
      expect(result).toContain('export function AsPostApiController()');
      expect(result).toContain("Controller('posts')");
      expect(result).toContain("Get(':id')");
      expect(result).toContain('HttpCode(HttpStatus.OK)');
      expect(result).toContain("Param()(constructor.prototype, 'get', 0)");
    });

    it('should render operations with query parameters', () => {
      const apiSpec: ParsedApiSpec = {
        filePath: '/project/api/post.api.yaml',
        title: 'Post API',
        resourceName: 'Post',
        basePath: '/posts',
        operations: [
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
            responses: [{ statusCode: '200', description: 'Success' }],
          },
        ],
      };

      const result = renderControllerFile(
        apiSpec,
        modelClassSchemas,
        '/project/service/src/api/post.api.controller.ts',
        '/project/service/src/api/model.ts',
        '/project/service/src/model/generated.ts',
      );

      expect(result).toContain('Query');
      expect(result).toContain('PostListQueryParams');
      expect(result).toContain('query: PostListQueryParams');
      expect(result).toContain("Query()(constructor.prototype, 'list', 0)");
    });

    it('should render operations with request body', () => {
      const apiSpec: ParsedApiSpec = {
        filePath: '/project/api/post.api.yaml',
        title: 'Post API',
        resourceName: 'Post',
        basePath: '/posts',
        operations: [
          {
            operationId: 'postCreate',
            method: 'post',
            path: '/posts',
            parameters: [],
            requestBody: {
              required: true,
              schemaRef: './dtos/post-create.dto.yaml',
            },
            responses: [
              {
                statusCode: '201',
                schemaRef: '../entities/post.yaml',
              },
            ],
          },
        ],
      };

      const result = renderControllerFile(
        apiSpec,
        modelClassSchemas,
        '/project/service/src/api/post.api.controller.ts',
        '/project/service/src/api/model.ts',
        '/project/service/src/model/generated.ts',
      );

      expect(result).toContain('Body');
      expect(result).toContain('Post');
      expect(result).toContain('PostCreateDto');
      expect(result).toContain('body: PostCreateDto');
      expect(result).toContain('HttpCode(HttpStatus.CREATED)');
      expect(result).toContain("Body()(constructor.prototype, 'create', 0)");
    });

    it('should render void return type for 204 responses', () => {
      const apiSpec: ParsedApiSpec = {
        filePath: '/project/api/post.api.yaml',
        title: 'Post API',
        resourceName: 'Post',
        basePath: '/posts',
        operations: [
          {
            operationId: 'postDelete',
            method: 'delete',
            path: '/posts/{id}',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
              },
            ],
            responses: [{ statusCode: '204', description: 'Deleted' }],
          },
        ],
      };

      const result = renderControllerFile(
        apiSpec,
        modelClassSchemas,
        '/project/service/src/api/post.api.controller.ts',
        '/project/service/src/api/model.ts',
        '/project/service/src/model/generated.ts',
      );

      expect(result).toContain('Delete');
      expect(result).toContain('): Promise<void>');
      expect(result).toContain('HttpCode(HttpStatus.NO_CONTENT)');
    });

    it('should render operations with both path and query params', () => {
      const apiSpec: ParsedApiSpec = {
        filePath: '/project/api/post.api.yaml',
        title: 'Post API',
        resourceName: 'Post',
        basePath: '/posts',
        operations: [
          {
            operationId: 'postUpdate',
            method: 'patch',
            path: '/posts/{id}',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
              },
              {
                name: 'updatedAt',
                in: 'query',
                required: true,
                schema: { type: 'string', format: 'date-time' },
              },
            ],
            requestBody: {
              required: true,
              schemaRef: './dtos/post-update.dto.yaml',
            },
            responses: [
              { statusCode: '200', schemaRef: '../entities/post.yaml' },
            ],
          },
        ],
      };

      const result = renderControllerFile(
        apiSpec,
        modelClassSchemas,
        '/project/service/src/api/post.api.controller.ts',
        '/project/service/src/api/model.ts',
        '/project/service/src/model/generated.ts',
      );

      expect(result).toContain('Patch');
      expect(result).toContain('params: PostUpdatePathParams');
      expect(result).toContain('query: PostUpdateQueryParams');
      expect(result).toContain("Param()(constructor.prototype, 'update', 0)");
      expect(result).toContain("Query()(constructor.prototype, 'update', 1)");
      expect(result).toContain("Body()(constructor.prototype, 'update', 2)");
    });

    it('should derive method names by stripping resource prefix', () => {
      const apiSpec: ParsedApiSpec = {
        filePath: '/project/api/post-import-job.api.yaml',
        title: 'PostImportJob API',
        resourceName: 'PostImportJob',
        basePath: '/postImportJobs',
        operations: [
          {
            operationId: 'postImportJobRetry',
            method: 'post',
            path: '/postImportJobs/{id}/retry',
            parameters: [
              {
                name: 'id',
                in: 'path',
                required: true,
                schema: { type: 'string' },
              },
            ],
            responses: [{ statusCode: '200' }],
          },
        ],
      };

      const result = renderControllerFile(
        apiSpec,
        {},
        '/project/service/src/api/post-import-job.api.controller.ts',
        '/project/service/src/api/model.ts',
        '/project/service/src/model/generated.ts',
      );

      expect(result).toContain('export interface PostImportJobApiContract');
      expect(result).toContain('retry(');
      expect(result).toContain('AsPostImportJobApiController');
      expect(result).toContain("Post(':id/retry')");
    });
  });
});
