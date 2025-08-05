import type {
  CausaObjectAttributes,
  CausaPropertyAttributes,
} from '@causa/workspace-core';
import type { Logger } from 'pino';
import {
  ClassProperty,
  ClassType,
  Name,
  type OptionValues,
  type RenderContext,
  type Sourcelike,
  TargetLanguage,
  TypeScriptRenderer,
  tsFlowOptions,
} from 'quicktype-core';
import type { TypeScriptDecorator } from './decorator.js';

/**
 * The TypeScript-specific Causa attributes that can be added to an object schema.
 */
type TypeScriptCausaObjectAttributes = {
  /**
   * A list of decorator names that should not be added to the class.
   * This can override the behavior of renderers.
   */
  tsExcludedDecorators?: string[];

  /**
   * A list of decorators that should be added to the class.
   */
  tsDecorators?: TypeScriptDecorator[];
};

/**
 * The TypeScript-specific Causa attributes that can be added to a property schema.
 */
type TypeScriptCausaPropertyAttributes = {
  /**
   * A list of decorator names that should not be added to the property.
   * This can override the behavior of renderers.
   */
  tsExcludedDecorators?: string[];

  /**
   * The type of the property.
   * This overrides the default JavaScript type for the property.
   */
  tsType?: string;

  /**
   * A list of decorators that should be added to the property.
   */
  tsDecorators?: TypeScriptDecorator[];

  /**
   * The default value for the property.
   */
  tsDefault?: string;
};

/**
 * The context passed to determine the decorators for a class.
 */
export type ClassContext = {
  /**
   * The type of the class.
   */
  classType: ClassType;

  /**
   * The Causa attributes found in the schema for the class.
   */
  objectAttributes: CausaObjectAttributes & TypeScriptCausaObjectAttributes;
};

/**
 * The context passed to determine the decorators for a class property.
 */
export type ClassPropertyContext = ClassContext & {
  /**
   * The name of the property.
   */
  name: Name;

  /**
   * The original name of the property in the schema.
   */
  jsonName: string;

  /**
   * The property definition.
   */
  property: ClassProperty;

  /**
   * The Causa attributes found in the schema for the property.
   */
  propertyAttributes: CausaPropertyAttributes &
    TypeScriptCausaPropertyAttributes;

  /**
   * Whether the property is defined as a constant.
   * The `quicktype` type should be an enum with a single value.
   */
  isConst: boolean;
};

/**
 * A {@link TypeScriptRenderer} that can determine the decorators to add to a class and its properties.
 *
 * This renderer is meant to be subclassed by renderers whose only job is to list decorators for a given TypeScript
 * feature. For example, this could be validation decorators.
 *
 * **Subclasses should not define any other methods.** The way subclasses are meant to be used is to call
 * {@link TypeScriptDecoratorsRenderer.decoratorsForClass} and
 * {@link TypeScriptDecoratorsRenderer.decoratorsForProperty} against a base {@link TypeScriptRenderer}. This means
 * subclasses should not hold a state nor define any other methods. However, they can call {@link TypeScriptRenderer}
 * (and {@link TypeScriptDecoratorsRenderer}) methods, which will let them access the TypeScript code generation
 * utilities. They can also retrieve options from {@link TypeScriptDecoratorsRenderer.generatorOptions}.
 */
export abstract class TypeScriptDecoratorsRenderer extends TypeScriptRenderer {
  constructor(
    targetLanguage: TargetLanguage,
    renderContext: RenderContext,
    _tsFlowOptions: OptionValues<typeof tsFlowOptions>,
    /**
     * The logger to use for non-error messages.
     * Use `panic` from `quicktype-core` for errors.
     */
    protected readonly logger: Logger,
    /**
     * Options available for the base rending logic and decorator renderers, retrieved from the Causa configuration.
     */
    readonly generatorOptions: Record<string, any>,
  ) {
    super(targetLanguage, renderContext, _tsFlowOptions);
  }

  /**
   * Returns the decorators that should be added to the class.
   *
   * @param context The context providing information about the class.
   */
  abstract decoratorsForClass(context: ClassContext): TypeScriptDecorator[];

  /**
   * Returns the decorators that should be added to the class property.
   *
   * @param context The context providing information about the class property.
   */
  abstract decoratorsForProperty(
    context: ClassPropertyContext,
  ): TypeScriptDecorator[];

  /**
   * A utility method to add a decorator to a list of decorators.
   * This checks the `tsExcludedDecorators` attribute on the class or property to determine if the decorator should be
   * added.
   *
   * @param decorators The list of decorators to which the decorator should be added.
   * @param context The context providing information about the class or class property.
   * @param name The name of the decorator. An import will be added for this name.
   * @param modulePath The path to the module from which the decorator is imported.
   * @param source The source code for the decorator.
   * @param options Options for the decorator.
   */
  addDecoratorToList(
    decorators: TypeScriptDecorator[],
    context: ClassContext | ClassPropertyContext,
    name: string,
    modulePath: string,
    source: Sourcelike,
    options: {
      /**
       * Additional imports required by the decorator.
       */
      imports?: Record<string, string[]>;
    } = {},
  ) {
    if (
      context.objectAttributes.tsExcludedDecorators?.includes(name) ||
      ('propertyAttributes' in context &&
        context.propertyAttributes.tsExcludedDecorators?.includes(name))
    ) {
      return;
    }

    const imports = { ...options.imports };
    if (modulePath in imports) {
      if (!imports[modulePath].includes(name)) {
        imports[modulePath].push(name);
      }
    } else {
      imports[modulePath] = [name];
    }

    decorators.push({ source, imports });
  }
}
