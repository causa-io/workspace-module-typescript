import { createContext } from '@causa/workspace/testing';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { TypeScriptModelClassTargetLanguage } from '../model-class/language.js';
import { generateFromSchema } from '../utils.test.js';
import { PrimitiveTypeTransformerRenderer } from './primitive-type-transformer-renderer.js';

describe('PrimitiveTypeTransformerRenderer', () => {
  let tmpDir: string;
  let outputFile: string;
  let language: TypeScriptModelClassTargetLanguage;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'causa-test-'));
    outputFile = join(tmpDir, 'test-output.ts');
    language = new TypeScriptModelClassTargetLanguage(
      outputFile,
      createContext().context,
      { decoratorRenderers: [PrimitiveTypeTransformerRenderer] },
    );
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should add @Type decorator for primitive non-string properties', async () => {
    const schema = {
      type: 'object',
      properties: {
        myInt: { type: 'integer' },
        myNumber: { type: 'number' },
        myBool: { type: 'boolean' },
        myNullableInt: { oneOf: [{ type: 'integer' }, { type: 'null' }] },
        myString: { type: 'string' },
        myDate: { type: 'string', format: 'date-time' },
        myUuid: { type: 'string', format: 'uuid' },
      },
      additionalProperties: false,
    };

    const actualCode = await generateFromSchema(language, schema, outputFile);

    expect(actualCode).toMatch(/@Type\(\(\) => Number\)\n\s+readonly myInt/);
    expect(actualCode).toMatch(/@Type\(\(\) => Number\)\n\s+readonly myNumber/);
    expect(actualCode).toMatch(/@Type\(\(\) => Boolean\)\n\s+readonly myBool/);
    expect(actualCode).toMatch(
      /@Type\(\(\) => Number\)\n\s+readonly myNullableInt/,
    );
    expect(actualCode).not.toMatch(/@Type\([^)]+\)\n\s+readonly myString/);
    expect(actualCode).not.toMatch(/@Type\([^)]+\)\n\s+readonly myDate/);
    expect(actualCode).not.toMatch(/@Type\([^)]+\)\n\s+readonly myUuid/);
  });
});
