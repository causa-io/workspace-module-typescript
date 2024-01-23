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
          oneOf: [
            { type: 'null' },
            { type: 'array', items: { type: 'string' } },
          ],
        },
        myObject: {
          type: 'object',
          additionalProperties: { type: 'string' },
        },
        myNullableClass: {
          oneOf: [
            { type: 'null' },
            {
              title: 'MyClass3',
              type: 'object',
              additionalProperties: false,
            },
          ],
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
        myArrayOfNullables: {
          type: 'array',
          items: { oneOf: [{ type: 'null' }, { type: 'boolean' }] },
        },
        myArrayOfNullableClasses: {
          type: 'array',
          items: {
            oneOf: [
              { type: 'null' },
              {
                title: 'MyClass4',
                type: 'object',
                additionalProperties: false,
              },
            ],
          },
        },
      },
      required: ['myClass'],
      additionalProperties: false,
    };

    const actualCode = await generateFromSchema(language, schema, outputFile);

    expect(actualCode).toMatch(
      /@ApiExtraModels\(.*MyClass.*\)\n\s*export class Test/,
    );
    expect(actualCode).toMatch(
      /@ApiExtraModels\(.*MyClass2.*\)\n\s*export class Test/,
    );
    expect(actualCode).toMatch(
      /@ApiExtraModels\(.*MyClass3.*\)\n\s*export class Test/,
    );
    expect(actualCode).toMatch(
      /@ApiExtraModels\(.*MyClass4.*\)\n\s*export class Test/,
    );
    expect(actualCode).toMatch(
      /import \{.*ApiProperty.*\} from "@nestjs\/swagger"/,
    );
    expect(actualCode).toMatch(
      /import \{.*getSchemaPath.*\} from "@nestjs\/swagger"/,
    );
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
      /@ApiProperty\({\s*type: "string",\s*enum: \["a", "b", "c"\]\s*}\)\n\s+readonly myEnum/,
    );
    expect(actualCode).toMatch(
      /@ApiProperty\({\s*oneOf: \[\s*\{ type: "integer" \},\s*\{ type: "null" \}\s*\]\s*}\)\n\s+readonly myInt/,
    );
    expect(actualCode).toMatch(
      /@ApiProperty\({\s*type: "number"\s*}\)\n\s+readonly myNumber/,
    );
    expect(actualCode).toMatch(
      /@ApiProperty\({\s*type: "boolean"\s*}\)\n\s+readonly myBool/,
    );
    expect(actualCode).toMatch(
      /@ApiProperty\({\s*oneOf: \[\{\s*\$ref: getSchemaPath\(MyClass\)\s*\}\]\s*}\)\n\s+readonly myClass/,
    );
    expect(actualCode).toMatch(
      /@ApiProperty\(\{\s*oneOf: \[\{\s*\$ref: getSchemaPath\(MyClass3\)\s*\},\s*\{ type: "null" \}\]\s*\}\)\n\s+readonly myNullableClass/,
    );
    expect(actualCode).toMatch(
      /@ApiProperty\(\{\s*oneOf: \[\s*\{ type: "array",\s*items:\s*\{\s*type: "string"\s*\}\s*\},\s*\{ type: "null" \}\s*\],\s*\}\)\n\s+readonly myArray/,
    );
    expect(actualCode).toMatch(
      /@ApiProperty\({\s*type: "object",\s*additionalProperties: { type: "string" }\s*}\)\n\s+readonly myObject/,
    );
    expect(actualCode).toMatch(
      /@ApiProperty\({\s*type: "object",\s*additionalProperties: true\s*}\)\n\s+readonly myObjectWithAny/,
    );
    expect(actualCode).toMatch(
      /@ApiProperty\(\{\s*type: "array",\s*items:\s*\{\s*oneOf: \[\{\s*\$ref: getSchemaPath\(MyClass2\)\s*\}\]\s*\},\s*\}\)\n\s+readonly myArrayOfClasses/,
    );
    expect(actualCode).toMatch(
      /@ApiProperty\(\{\s*type: "array",\s*items:\s*\{\s*oneOf: \[\{\s*type: "boolean"\s*\},\s*\{ type: "null" \}\s*\]\s*\},\s*\}\)\n\s+readonly myArrayOfNullables/,
    );
    expect(actualCode).toMatch(
      /@ApiProperty\(\{\s*type: "array",\s*items:\s*\{\s*oneOf: \[\{\s*\$ref: getSchemaPath\(MyClass4\)\s*\},\s*\{ type: "null" \}\s*\]\s*\},\s*\}\)\n\s+readonly myArrayOfNullableClasses/,
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
    expect(actualCode).not.toContain('@ApiExtraModels');
  });
});
