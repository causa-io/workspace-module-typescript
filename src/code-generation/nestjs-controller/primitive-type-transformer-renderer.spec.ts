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
      {
        decoratorRenderers: [PrimitiveTypeTransformerRenderer],
      },
    );
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('should add @Type decorator for integer properties', async () => {
    const schema = {
      type: 'object',
      properties: {
        myInt: { type: 'integer' },
      },
      additionalProperties: false,
    };

    const actualCode = await generateFromSchema(language, schema, outputFile);

    expect(actualCode).toMatch(/@Type\(\(\) => Number\)\n\s+readonly myInt/);
  });

  it('should add @Type decorator for number properties', async () => {
    const schema = {
      type: 'object',
      properties: {
        myNumber: { type: 'number' },
      },
      additionalProperties: false,
    };

    const actualCode = await generateFromSchema(language, schema, outputFile);

    expect(actualCode).toMatch(/@Type\(\(\) => Number\)\n\s+readonly myNumber/);
  });

  it('should add @Type decorator for boolean properties', async () => {
    const schema = {
      type: 'object',
      properties: {
        myBool: { type: 'boolean' },
      },
      additionalProperties: false,
    };

    const actualCode = await generateFromSchema(language, schema, outputFile);

    expect(actualCode).toMatch(/@Type\(\(\) => Boolean\)\n\s+readonly myBool/);
  });

  it('should not add @Type decorator for string properties', async () => {
    const schema = {
      type: 'object',
      properties: {
        myString: { type: 'string' },
      },
      additionalProperties: false,
    };

    const actualCode = await generateFromSchema(language, schema, outputFile);

    expect(actualCode).not.toContain('@Type');
    expect(actualCode).toContain('readonly myString');
  });

  it('should not add @Type decorator for date-time properties', async () => {
    const schema = {
      type: 'object',
      properties: {
        myDate: { type: 'string', format: 'date-time' },
      },
      additionalProperties: false,
    };

    const actualCode = await generateFromSchema(language, schema, outputFile);

    expect(actualCode).not.toContain('@Type(() => Number)');
    expect(actualCode).not.toContain('@Type(() => Boolean)');
  });

  it('should not add @Type decorator for uuid properties', async () => {
    const schema = {
      type: 'object',
      properties: {
        myUuid: { type: 'string', format: 'uuid' },
      },
      additionalProperties: false,
    };

    const actualCode = await generateFromSchema(language, schema, outputFile);

    expect(actualCode).not.toContain('@Type');
    expect(actualCode).toContain('readonly myUuid');
  });

  it('should handle nullable primitive types', async () => {
    const schema = {
      type: 'object',
      properties: {
        myInt: { oneOf: [{ type: 'integer' }, { type: 'null' }] },
      },
      additionalProperties: false,
    };

    const actualCode = await generateFromSchema(language, schema, outputFile);

    expect(actualCode).toMatch(/@Type\(\(\) => Number\)\n\s+readonly myInt/);
  });
});
