import { mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { parseOpenApiSpec } from './openapi-parser.js';

describe('openapi-parser', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'causa-test-'));
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should parse a simple OpenAPI spec', async () => {
    const spec = `
openapi: 3.1.0
x-causaResourceName: Post
info:
  title: Post API
  description: The API to manage posts.
  version: 0.1.0
paths:
  /posts:
    get:
      operationId: postList
      summary: Lists all posts.
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
      operationId: postCreate
      summary: Creates a post.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: ./dtos/post-create.dto.yaml
      responses:
        "201":
          description: Created
          content:
            application/json:
              schema:
                $ref: ../entities/post.yaml
  /posts/{id}:
    get:
      operationId: postGet
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        "200":
          description: Success
          content:
            application/json:
              schema:
                $ref: ../entities/post.yaml
`;
    const filePath = join(tmpDir, 'post.api.yaml');
    await writeFile(filePath, spec);

    const result = await parseOpenApiSpec(filePath);

    expect(result.title).toEqual('Post API');
    expect(result.resourceName).toEqual('Post');
    expect(result.description).toEqual('The API to manage posts.');
    expect(result.basePath).toEqual('/posts');
    expect(result.operations).toHaveLength(3);

    // Check postList operation
    const listOp = result.operations.find(
      (op) => op.operationId === 'postList',
    );
    expect(listOp).toBeDefined();
    expect(listOp!.method).toEqual('get');
    expect(listOp!.path).toEqual('/posts');
    expect(listOp!.parameters).toHaveLength(1);
    expect(listOp!.parameters[0].name).toEqual('limit');
    expect(listOp!.parameters[0].in).toEqual('query');
    expect(listOp!.parameters[0].required).toEqual(false);

    // Check postCreate operation
    const createOp = result.operations.find(
      (op) => op.operationId === 'postCreate',
    );
    expect(createOp).toBeDefined();
    expect(createOp!.method).toEqual('post');
    expect(createOp!.requestBody).toBeDefined();
    expect(createOp!.requestBody!.schemaRef).toEqual(
      './dtos/post-create.dto.yaml',
    );

    // Check postGet operation
    const getOp = result.operations.find((op) => op.operationId === 'postGet');
    expect(getOp).toBeDefined();
    expect(getOp!.method).toEqual('get');
    expect(getOp!.path).toEqual('/posts/{id}');
    expect(getOp!.parameters).toHaveLength(1);
    expect(getOp!.parameters[0].name).toEqual('id');
    expect(getOp!.parameters[0].in).toEqual('path');
    expect(getOp!.parameters[0].required).toEqual(true);
    expect(getOp!.parameters[0].schema).toEqual({
      type: 'string',
      format: 'uuid',
    });
  });

  it('should merge path-level and operation-level parameters', async () => {
    const spec = `
openapi: 3.1.0
x-causaResourceName: Post
info:
  title: Post API
  version: 0.1.0
paths:
  /posts/{id}:
    parameters:
      - name: id
        in: path
        required: true
        schema:
          type: string
    get:
      operationId: postGet
      parameters:
        - name: includeDeleted
          in: query
          schema:
            type: boolean
      responses:
        "200":
          description: Success
`;
    const filePath = join(tmpDir, 'post.api.yaml');
    await writeFile(filePath, spec);

    const result = await parseOpenApiSpec(filePath);

    const getOp = result.operations.find((op) => op.operationId === 'postGet');
    expect(getOp!.parameters).toHaveLength(2);
    expect(getOp!.parameters.map((p) => p.name)).toEqual([
      'id',
      'includeDeleted',
    ]);
  });

  it('should parse multiple response types', async () => {
    const spec = `
openapi: 3.1.0
x-causaResourceName: Post
info:
  title: Post API
  version: 0.1.0
paths:
  /posts/{id}:
    delete:
      operationId: postDelete
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
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
    const filePath = join(tmpDir, 'post.api.yaml');
    await writeFile(filePath, spec);

    const result = await parseOpenApiSpec(filePath);

    const deleteOp = result.operations.find(
      (op) => op.operationId === 'postDelete',
    );
    expect(deleteOp!.responses).toHaveLength(2);

    const noContentResponse = deleteOp!.responses.find(
      (r) => r.statusCode === 204,
    );
    expect(noContentResponse).toBeDefined();
    expect(noContentResponse!.schemaRef).toBeUndefined();

    const notFoundResponse = deleteOp!.responses.find(
      (r) => r.statusCode === 404,
    );
    expect(notFoundResponse).toBeDefined();
    expect(notFoundResponse!.schemaRef).toEqual('./errors/not-found.yaml');
  });
});
