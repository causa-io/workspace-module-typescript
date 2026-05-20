import { WorkspaceFunction } from '@causa/workspace';
import type { ObjectSchema, Property, Schema } from '@causa/workspace-core';
import { IsObject, IsString } from 'class-validator';
import type { TypeScriptDecorator } from '../code-generation/index.js';

/**
 * Returns the TypeScript decorators that should be added to a class or property of a generated model class.
 *
 * Implementations of {@link WorkspaceFunction._supports} should return `true` based on the
 * {@link ModelGenerateTypeScriptDecorators.generator} and {@link ModelGenerateTypeScriptDecorators.configuration} when
 * the renderer is relevant.
 */
export abstract class ModelGenerateTypeScriptDecorators extends WorkspaceFunction<
  TypeScriptDecorator[] | Promise<TypeScriptDecorator[]>
> {
  /**
   * The name of the code generator being run.
   */
  @IsString()
  readonly generator!: string;

  /**
   * The configuration for the code generator.
   */
  @IsObject()
  readonly configuration!: Record<string, unknown>;

  /**
   * All schemas being rendered together, indexed by their absolute path.
   * Used by implementations to resolve references (e.g. `constraintFor`, `enumHint`).
   */
  @IsObject()
  readonly schemas!: Record<string, Schema>;

  /**
   * The object schema the decorators should be generated for.
   */
  @IsObject()
  readonly schema!: ObjectSchema;

  /**
   * When set, the property within {@link schema} the decorators should be generated for.
   * When `undefined`, decorators are generated for the class itself.
   */
  @IsObject()
  readonly property?: Property;
}
