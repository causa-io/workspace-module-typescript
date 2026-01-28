import type { GeneratedSchemas } from '@causa/workspace-core';
import { renderControllerFile } from './controller-renderer.js';
import type { ParsedApiSpec } from './types.js';

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
    '/project/api/dtos/post-update.dto.yaml': {
      name: 'PostUpdateDto',
      file: '/project/service/src/model/generated.ts',
    },
  };

  const paramsSchemas: GeneratedSchemas = {
    'postGet/path': {
      name: 'PostGetPathParams',
      file: '/project/service/src/api/model.ts',
    },
    'postList/query': {
      name: 'PostListQueryParams',
      file: '/project/service/src/api/model.ts',
    },
    'postDelete/path': {
      name: 'PostDeletePathParams',
      file: '/project/service/src/api/model.ts',
    },
    'postUpdate/path': {
      name: 'PostUpdatePathParams',
      file: '/project/service/src/api/model.ts',
    },
    'postUpdate/query': {
      name: 'PostUpdateQueryParams',
      file: '/project/service/src/api/model.ts',
    },
    'postImportJobRetry/path': {
      name: 'PostImportJobRetryPathParams',
      file: '/project/service/src/api/model.ts',
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
          successResponse: {
            statusCode: 200,
            description: 'The post.',
            schemaRef: '../entities/post.yaml',
          },
        },
      ],
    };

    const result = renderControllerFile(
      apiSpec,
      modelClassSchemas,
      paramsSchemas,
      '/project/service/src/api/post.api.controller.ts',
    );

    // Check imports
    expect(result).toContain("from '@nestjs/common'");
    expect(result).toContain('Controller as _Controller');
    expect(result).toContain('Get as _Get');
    expect(result).toContain('HttpCode as _HttpCode');
    expect(result).toContain('HttpStatus as _HttpStatus');
    expect(result).toContain('Param as _Param');
    expect(result).toContain('type Type as _Type');

    // Check param imports from generated schemas
    expect(result).toContain("from './model.js'");

    // Check external type imports from generated schemas
    expect(result).toContain("from '../model/generated.js'");
    expect(result).toContain('type Post');

    // Check interface
    expect(result).toContain('export interface PostApiContract');
    expect(result).toContain('get(');
    expect(result).toContain('params: PostGetPathParams');
    expect(result).toContain('...rest: any[]');
    expect(result).toContain('): Promise<Post>');

    // Check decorator factory
    expect(result).toContain('export function AsPostApiController()');
    expect(result).toContain("_Controller('posts')");
    expect(result).toContain("_Get(':id')");
    expect(result).toContain('_HttpCode(_HttpStatus.OK)');
    expect(result).toContain("_Param()(constructor.prototype, 'get', 0)");
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
          successResponse: { statusCode: 200 },
        },
      ],
    };

    const result = renderControllerFile(
      apiSpec,
      modelClassSchemas,
      paramsSchemas,
      '/project/service/src/api/post.api.controller.ts',
    );

    expect(result).toContain('Query as _Query');
    expect(result).toContain('query: PostListQueryParams');
    expect(result).toContain("_Query()(constructor.prototype, 'list', 0)");
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
          requestBodyRef: './dtos/post-create.dto.yaml',
          successResponse: {
            statusCode: 201,
            schemaRef: '../entities/post.yaml',
          },
        },
      ],
    };

    const result = renderControllerFile(
      apiSpec,
      modelClassSchemas,
      paramsSchemas,
      '/project/service/src/api/post.api.controller.ts',
    );

    expect(result).toContain('Body as _Body');
    expect(result).toContain('Post as _Post');
    expect(result).toContain('PostCreateDto');
    expect(result).toContain('body: PostCreateDto');
    expect(result).toContain('_HttpCode(_HttpStatus.CREATED)');
    expect(result).toContain("_Body()(constructor.prototype, 'create', 0)");
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
          successResponse: { statusCode: 204 },
        },
      ],
    };

    const result = renderControllerFile(
      apiSpec,
      modelClassSchemas,
      paramsSchemas,
      '/project/service/src/api/post.api.controller.ts',
    );

    expect(result).toContain('Delete as _Delete');
    expect(result).toContain('): Promise<void>');
    expect(result).toContain('_HttpCode(_HttpStatus.NO_CONTENT)');
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
          requestBodyRef: './dtos/post-update.dto.yaml',
          successResponse: {
            statusCode: 200,
            schemaRef: '../entities/post.yaml',
          },
        },
      ],
    };

    const result = renderControllerFile(
      apiSpec,
      modelClassSchemas,
      paramsSchemas,
      '/project/service/src/api/post.api.controller.ts',
    );

    expect(result).toContain('Patch as _Patch');
    expect(result).toContain('params: PostUpdatePathParams');
    expect(result).toContain('query: PostUpdateQueryParams');
    expect(result).toContain("_Param()(constructor.prototype, 'update', 0)");
    expect(result).toContain("_Query()(constructor.prototype, 'update', 1)");
    expect(result).toContain("_Body()(constructor.prototype, 'update', 2)");
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
          successResponse: { statusCode: 200 },
        },
      ],
    };

    const result = renderControllerFile(
      apiSpec,
      {},
      paramsSchemas,
      '/project/service/src/api/post-import-job.api.controller.ts',
    );

    expect(result).toContain('export interface PostImportJobApiContract');
    expect(result).toContain('retry(');
    expect(result).toContain('AsPostImportJobApiController');
    expect(result).toContain("_Post(':id/retry')");
  });
});
