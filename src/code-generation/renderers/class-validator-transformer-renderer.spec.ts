import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { pino } from 'pino';
import { TypeScriptWithDecoratorsTargetLanguage } from '../language.js';
import { generateFromSchema } from '../utils.test.js';
import { ClassValidatorTransformerPropertyDecoratorsRenderer } from './class-validator-transformer-renderer.js';

describe('ClassValidatorTransformerPropertyDecoratorsRenderer', () => {
  let tmpDir: string;
  let outputFile: string;
  let language: TypeScriptWithDecoratorsTargetLanguage;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'causa-test-'));
    outputFile = join(tmpDir, 'test-output.ts');
    language = new TypeScriptWithDecoratorsTargetLanguage(outputFile, pino(), {
      decoratorRenderers: [ClassValidatorTransformerPropertyDecoratorsRenderer],
    });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should decorate properties with the corresponding validators', async () => {
    const schema = {
      type: 'object',
      properties: {
        myDate: { type: 'string', format: 'date-time' },
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
          items: { type: 'string', format: 'uuid' },
        },
        myOverride: { type: 'integer', causa: { tsType: 'bigint' } },
        myObject: { type: 'object', additionalProperties: true },
        myNull: { type: 'null' },
      },
      required: ['myClass'],
      additionalProperties: false,
    };

    const actualCode = await generateFromSchema(language, schema, outputFile);

    expect(actualCode).toMatch(/@IsString\(\)\n\s+readonly myString/);
    expect(actualCode).toMatch(
      /@IsDate\(\)\n\s+@Type\(\(\) => Date\)\n\s+readonly myDate/,
    );
    expect(actualCode).toMatch(/@IsUUID\(undefined\)\n\s+readonly myUuid/);
    expect(actualCode).toMatch(
      /@IsIn\(\["a", "b", "c"\]\)\n\s+readonly myEnum/,
    );
    expect(actualCode).toMatch(/@IsInt\(\)\n\s+readonly myInt/);
    expect(actualCode).toMatch(/@IsNumber\(\)\n\s+readonly myNumber/);
    expect(actualCode).toMatch(/@IsBoolean\(\)\n\s+readonly myBool/);
    expect(actualCode).toMatch(
      /@ValidateNested\(\)\n\s+@IsDefined\(\)\n\s+@Type\(\(\) => MyClass\)\s+readonly myClass/,
    );
    expect(actualCode).toMatch(
      /@IsArray\(\)\n\s+@IsUUID\(undefined, { each: true }\)\n\s+readonly myArray/,
    );
    expect(actualCode).toMatch(/[^@]*\n\s+readonly myOverride/);
    expect(actualCode).toMatch(/@IsObject\(\)\n\s+readonly myObject/);
    expect(actualCode).toMatch(/@Equals\(null\)\n\s+readonly myNull/);
  });
});
