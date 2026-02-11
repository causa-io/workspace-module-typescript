import { CausaListConfigurationSchemas } from '@causa/workspace-core';
import { createContext } from '@causa/workspace/testing';
import 'jest-extended';
import { basename } from 'path';
import { CausaListConfigurationSchemasForTypeScript } from './list-schemas.js';

describe('CausaListConfigurationSchemasForTypeScript', () => {
  it('should return the configuration schemas for the TypeScript module', async () => {
    const { context } = createContext({
      configuration: { workspace: { name: 'test' } },
      functions: [CausaListConfigurationSchemasForTypeScript],
    });

    const actualSchemas = await context.call(CausaListConfigurationSchemas, {});

    const actualBaseNames = actualSchemas.map((s) => basename(s));
    expect(actualBaseNames).toIncludeSameMembers([
      'model.yaml',
      'project.yaml',
      'typescript.yaml',
    ]);
  });
});
