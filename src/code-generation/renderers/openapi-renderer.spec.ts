import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { TypeScriptWithDecoratorsTargetLanguage } from '../language.js';
import { generateFromSchema } from '../utils.test.js';
import { OpenApiRenderer } from './openapi-renderer.js';

describe('OpenApiRenderer', () => {
  let tmpDir: string;
  let outputFile: string;
  let language: TypeScriptWithDecoratorsTargetLanguage;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'causa-test-'));
    outputFile = join(tmpDir, 'test-output.ts');
    language = new TypeScriptWithDecoratorsTargetLanguage(outputFile, {
      decoratorRenderers: [OpenApiRenderer],
    });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should decorate properties with the corresponding validators', async () => {
    const schema = {
      type: 'object',
      causa: { tsOpenApi: true },
      properties: {
        myDate: { type: 'string', format: 'date-time', description: '📆' },
        myUuid: { type: 'string', format: 'uuid' },
        myString: { type: 'string' },
        myEnum: { type: 'string', enum: ['a', 'b', 'c'] },
        myInt: { oneOf: [{ type: 'integer' }, { type: 'null' }] },
        myNumber: { type: 'number' },
        myBool: { type: 'boolean' },
        myClass: {
          title: 'MyClass',
          type: 'object',
          additionalProperties: false,
        },
        myArray: {
          type: 'array',
          items: { type: 'string' },
        },
        myObject: {
          type: 'object',
          additionalProperties: { type: 'string' },
        },
        myObjectWithAny: {
          type: 'object',
          additionalProperties: true,
        },
        myArrayOfClasses: {
          type: 'array',
          items: {
            title: 'MyClass2',
            type: 'object',
            additionalProperties: false,
          },
        },
      },
      required: ['myClass'],
      additionalProperties: false,
    };

    const actualCode = await generateFromSchema(language, schema, outputFile);

    expect(actualCode).toMatch(
      /@ApiProperty\({\s*description: "📆",\s*type: "string",\s*format: "date-time"\s*}\)\n\s+readonly myDate/,
    );
    expect(actualCode).toMatch(
      /@ApiProperty\({\s*type: "string",\s*format: "uuid"\s*}\)\n\s+readonly myUuid/,
    );
    expect(actualCode).toMatch(
      /@ApiProperty\({\s*type: "string"\s*}\)\n\s+readonly myString/,
    );
    expect(actualCode).toMatch(
      /@ApiProperty\({\s*enum: \["a", "b", "c"\]\s*}\)\n\s+readonly myEnum/,
    );
    expect(actualCode).toMatch(
      /@ApiProperty\({\s*nullable: true,\s*type: "integer"\s*}\)\n\s+readonly myInt/,
    );
    expect(actualCode).toMatch(
      /@ApiProperty\({\s*type: "number"\s*}\)\n\s+readonly myNumber/,
    );
    expect(actualCode).toMatch(
      /@ApiProperty\({\s*type: "boolean"\s*}\)\n\s+readonly myBool/,
    );
    expect(actualCode).toMatch(
      /@ApiProperty\({\s*type: \(\) => MyClass\s*}\)\n\s+readonly myClass/,
    );
    expect(actualCode).toMatch(
      /@ApiProperty\({\s*type: "array",\s*items:\s*{\s*type: "string"\s*}\s*}\)\n\s+readonly myArray/,
    );
    expect(actualCode).toMatch(
      /@ApiProperty\({\s*type: "object",\s*additionalProperties: { type: "string" }\s*}\)\n\s+readonly myObject/,
    );
    expect(actualCode).toMatch(
      /@ApiProperty\({\s*type: "object",\s*additionalProperties: true\s*}\)\n\s+readonly myObjectWithAny/,
    );
    expect(actualCode).toMatch(
      /@ApiProperty\({\s*type: \(\) => \[MyClass2\]\s*}\)\n\s+readonly myArrayOfClasses/,
    );
  });

  it('should not decorate properties if tsOpenApi is not set', async () => {
    const schema = {
      type: 'object',
      properties: {
        myDate: { type: 'string', format: 'date-time', description: '📆' },
        myUuid: { type: 'string', format: 'uuid' },
        myString: { type: 'string' },
        myEnum: { type: 'string', enum: ['a', 'b', 'c'] },
        myInt: { oneOf: [{ type: 'integer' }, { type: 'null' }] },
        myNumber: { type: 'number' },
        myBool: { type: 'boolean' },
        myClass: {
          title: 'MyClass',
          type: 'object',
          additionalProperties: false,
        },
        myArray: {
          type: 'array',
          items: { type: 'string' },
        },
        myObject: {
          type: 'object',
          additionalProperties: { type: 'string' },
        },
      },
      required: ['myClass'],
      additionalProperties: false,
    };

    const actualCode = await generateFromSchema(language, schema, outputFile);

    expect(actualCode).not.toContain('@ApiProperty');
  });
});
