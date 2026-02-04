import type { GeneratedSchemas } from '@causa/workspace-core';
import { renderControllerFile } from './controller-renderer.js';
import type { ParsedApiSpecification } from './types.js';

describe('renderControllerFile', () => {
  it('should render a controller file', () => {
    const modelClassSchemas: GeneratedSchemas = {
      '/project/entities/car.yaml': {
        name: 'Car',
        file: '/project/service/src/model/generated.ts',
      },
      '/project/api/dtos/car-create.dto.yaml': {
        name: 'CarCreateDto',
        file: '/project/service/src/model/generated.ts',
      },
      '/project/api/dtos/car-update.dto.yaml': {
        name: 'CarUpdateDto',
        file: '/project/service/src/model/generated.ts',
      },
    };

    const paramsSchemas: GeneratedSchemas = {
      'carGet/path': {
        name: 'CarGetPathParams',
        file: '/project/service/src/api/model.ts',
      },
      'carList/query': {
        name: 'CarListQueryParams',
        file: '/project/service/src/api/model.ts',
      },
      'carDelete/path': {
        name: 'CarDeletePathParams',
        file: '/project/service/src/api/model.ts',
      },
      'carUpdate/path': {
        name: 'CarUpdatePathParams',
        file: '/project/service/src/api/model.ts',
      },
      'carUpdate/query': {
        name: 'CarUpdateQueryParams',
        file: '/project/service/src/api/model.ts',
      },
      'carArchive/path': {
        name: 'CarArchivePathParams',
        file: '/project/service/src/api/model.ts',
      },
    };

    const apiSpec: ParsedApiSpecification = {
      filePath: '/project/api/car.api.yaml',
      title: 'Car API',
      resourceName: 'Car',
      basePath: '/cars',
      operations: [
        {
          operationId: 'carGet',
          method: 'get',
          path: '/cars/{id}',
          summary: 'Gets a car by ID.',
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
            description: 'The car.',
            schemaRef: '../entities/car.yaml',
          },
        },
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
          successResponse: { statusCode: 200 },
        },
        {
          operationId: 'carCreate',
          method: 'post',
          path: '/cars',
          parameters: [],
          requestBodyRef: './dtos/car-create.dto.yaml',
          successResponse: {
            statusCode: 201,
            schemaRef: '../entities/car.yaml',
          },
        },
        {
          operationId: 'carDelete',
          method: 'delete',
          path: '/cars/{id}',
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
        {
          operationId: 'carUpdate',
          method: 'patch',
          path: '/cars/{id}',
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
          requestBodyRef: './dtos/car-update.dto.yaml',
          successResponse: {
            statusCode: 200,
            schemaRef: '../entities/car.yaml',
          },
        },
        {
          operationId: 'carArchive',
          method: 'post',
          path: '/cars/{id}/archive',
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
      modelClassSchemas,
      paramsSchemas,
      '/project/service/src/api/car.api.controller.ts',
    );

    // carGet: path params, 200 response with schema
    expect(result).toMatch(
      /get\(\s*params: CarGetPathParams,\s*\.\.\.rest: any\[\]\s*\): Promise<Car>/,
    );
    expect(result).toMatch(/_Get\(':id'\)\([^)]+, 'get'/);
    expect(result).toMatch(/_HttpCode\(_HttpStatus\.OK\)\([^)]+, 'get'/);
    expect(result).toMatch(/_Param\(\)\(constructor\.prototype, 'get', 0\)/);

    // carList: query params, 200 response without schema
    expect(result).toMatch(
      /list\(\s*query: CarListQueryParams,\s*\.\.\.rest: any\[\]\s*\): Promise<void>/,
    );
    expect(result).toMatch(/_Get\(''\)\([^)]+, 'list'/);
    expect(result).toMatch(/_HttpCode\(_HttpStatus\.OK\)\([^)]+, 'list'/);
    expect(result).toMatch(/_Query\(\)\(constructor\.prototype, 'list', 0\)/);

    // carCreate: request body, 201 response with schema
    expect(result).toMatch(
      /create\(\s*body: CarCreateDto,\s*\.\.\.rest: any\[\]\s*\): Promise<Car>/,
    );
    expect(result).toMatch(/_Post\(''\)\([^)]+, 'create'/);
    expect(result).toMatch(
      /_HttpCode\(_HttpStatus\.CREATED\)\([^)]+, 'create'/,
    );
    expect(result).toMatch(/_Body\(\)\(constructor\.prototype, 'create', 0\)/);

    // carDelete: path params, 204 response (void)
    expect(result).toMatch(
      /delete\(\s*params: CarDeletePathParams,\s*\.\.\.rest: any\[\]\s*\): Promise<void>/,
    );
    expect(result).toMatch(/_Delete\(':id'\)\([^)]+, 'delete'/);
    expect(result).toMatch(
      /_HttpCode\(_HttpStatus\.NO_CONTENT\)\([^)]+, 'delete'/,
    );
    expect(result).toMatch(/_Param\(\)\(constructor\.prototype, 'delete', 0\)/);

    // carUpdate: path + query params + body
    expect(result).toMatch(
      /update\(\s*params: CarUpdatePathParams,\s*query: CarUpdateQueryParams,\s*body: CarUpdateDto,\s*\.\.\.rest: any\[\]\s*\): Promise<Car>/,
    );
    expect(result).toMatch(/_Patch\(':id'\)\([^)]+, 'update'/);
    expect(result).toMatch(/_HttpCode\(_HttpStatus\.OK\)\([^)]+, 'update'/);
    expect(result).toMatch(/_Param\(\)\(constructor\.prototype, 'update', 0\)/);
    expect(result).toMatch(/_Query\(\)\(constructor\.prototype, 'update', 1\)/);
    expect(result).toMatch(/_Body\(\)\(constructor\.prototype, 'update', 2\)/);

    // carArchive: sub-path route
    expect(result).toMatch(/archive\(/);
    expect(result).toMatch(/_Post\(':id\/archive'\)\([^)]+, 'archive'/);
    expect(result).toMatch(/_HttpCode\(_HttpStatus\.OK\)\([^)]+, 'archive'/);

    // Imports
    expect(result).toMatch(/import \{[^}]*Controller as _Controller[^}]*\}/);
    expect(result).toMatch(/from '\.\/model\.js'/);
    expect(result).toMatch(/from '\.\.\/model\/generated\.js'/);

    // Interface and decorator factory
    expect(result).toMatch(/export interface CarApiContract/);
    expect(result).toMatch(/export function AsCarApiController\(\)/);
    expect(result).toMatch(/_Controller\('cars'\)/);
  });
});
