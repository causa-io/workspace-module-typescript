import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { pino } from 'pino';
import { TypeScriptWithDecoratorsTargetLanguage } from '../language.js';
import { generateFromSchema } from '../utils.test.js';
import { CausaValidatorRenderer } from './causa-validator-renderer.js';

describe('CausaValidatorRenderer', () => {
  let tmpDir: string;
  let outputFile: string;
  let language: TypeScriptWithDecoratorsTargetLanguage;

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'causa-test-'));
    outputFile = join(tmpDir, 'test-output.ts');
    language = new TypeScriptWithDecoratorsTargetLanguage(outputFile, pino(), {
      decoratorRenderers: [CausaValidatorRenderer],
    });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should decorate the properties with the IsNullable and AllowMissing decorators', async () => {
    const schema = {
      type: 'object',
      properties: {
        nullableProperty: {
          oneOf: [{ type: 'string' }, { type: 'null' }],
        },
        optionalProperty: { type: 'string' },
        nothingSpecialProperty: { type: 'number' },
        bothProperty: {
          oneOf: [{ type: 'string' }, { type: 'null' }],
        },
      },
      required: ['nullableProperty', 'nothingSpecialProperty'],
    };

    const actualCode = await generateFromSchema(language, schema, outputFile);

    expect(actualCode).toMatch(
      /@IsNullable\(\)\n\s+readonly nullableProperty!/,
    );
    expect(actualCode).toMatch(
      /@AllowMissing\(\)\n\s+readonly optionalProperty\?/,
    );
    expect(actualCode).toMatch(/\n[^@]+\n\s+readonly nothingSpecialProperty!/);
    expect(actualCode).toMatch(
      /@IsNullable\(\)\n\s+@AllowMissing\(\)\n\s+readonly bothProperty\?/,
    );
  });
});
