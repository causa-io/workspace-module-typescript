import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { parseOpenApiSpec } from './openapi-parser.js';

describe('openapi-parser', () => {
  let tmpDir: string;
  let filePath: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'causa-test-'));
    filePath = join(tmpDir, 'car.api.yaml');
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should parse an OpenAPI spec', async () => {
    const spec = `
openapi: 3.1.0
x-causaResourceName: Car
info:
  title: Car API
  description: The API to manage cars.
  version: 0.1.0
paths:
  /cars:
    get:
      operationId: carList
      summary: Lists all cars.
      parameters:
        - name: limit
          in: query
          required: false
          schema:
            type: integer
      responses:
        "200":
          description: Success
    post:
      operationId: carCreate
      summary: Creates a car.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: ./dtos/car-create.dto.yaml
      responses:
        "201":
          description: Created
          content:
            application/json:
              schema:
                $ref: ../entities/car.yaml
  /cars/{id}:
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: string
          format: uuid
    get:
      operationId: carGet
      parameters:
        - name: includeDeleted
          in: query
          schema:
            type: boolean
      responses:
        "200":
          description: Success
          content:
            application/json:
              schema:
                $ref: ../entities/car.yaml
    delete:
      operationId: carDelete
      responses:
        "204":
          description: Deleted successfully
        "404":
          description: Not found
          content:
            application/json:
              schema:
                $ref: ./errors/not-found.yaml
`;
    await writeFile(filePath, spec);

    const result = await parseOpenApiSpec(filePath);

    expect(result).toEqual({
      filePath,
      title: 'Car API',
      resourceName: 'Car',
      description: 'The API to manage cars.',
      basePath: '/cars',
      operations: [
        {
          operationId: 'carList',
          method: 'get',
          path: '/cars',
          summary: 'Lists all cars.',
          parameters: [
            {
              name: 'limit',
              in: 'query',
              required: false,
              schema: { type: 'integer' },
            },
          ],
          successResponse: { statusCode: 200, description: 'Success' },
        },
        {
          operationId: 'carCreate',
          method: 'post',
          path: '/cars',
          summary: 'Creates a car.',
          parameters: [],
          requestBodyRef: './dtos/car-create.dto.yaml',
          successResponse: {
            statusCode: 201,
            description: 'Created',
            schemaRef: '../entities/car.yaml',
          },
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
              schema: { type: 'string', format: 'uuid' },
            },
            {
              name: 'includeDeleted',
              in: 'query',
              required: false,
              schema: { type: 'boolean' },
            },
          ],
          successResponse: {
            statusCode: 200,
            description: 'Success',
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
              schema: { type: 'string', format: 'uuid' },
            },
          ],
          successResponse: {
            statusCode: 204,
            description: 'Deleted successfully',
          },
        },
      ],
    });
  });
});
