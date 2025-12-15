import {
  causaTypeAttributeKind,
  findTypeForUri,
  type CausaAttribute,
  type CausaObjectAttributes,
  type CausaPropertyAttributes,
  type GeneratedSchema,
} from '@causa/workspace-core';
import { dirname, relative, sep } from 'path';
import type { Logger } from 'pino';
import {
  ClassProperty,
  ClassType,
  EnumType,
  Name,
  Namer,
  ObjectType,
  Type,
  TypeScriptRenderer,
  funPrefixNamer,
  panic,
  tsFlowOptions,
  type OptionValues,
  type RenderContext,
  type Sourcelike,
} from 'quicktype-core';
import type { SourcelikeArray } from 'quicktype-core/dist/Source.js';
import { AcronymStyleOptions } from 'quicktype-core/dist/support/Acronyms.js';
import { ConvertersOptions } from 'quicktype-core/dist/support/Converters.js';
import type { TypeScriptDecorator } from './decorator.js';
import type { TypeScriptWithDecoratorsTargetLanguage } from './language.js';

const HASH_CODE_PREFIX = '$';

/**
 * The default suffix for constraint types.
 */
const DEFAULT_CONSTRAINT_SUFFIX = 'Constraint';

/**
 * Configuration for the base {@link TypeScriptRenderer}.
 */
const TSFLOW_OPTIONS: OptionValues<typeof tsFlowOptions> = {
  readonly: false,
  acronymStyle: AcronymStyleOptions.Pascal,
  preferTypes: true,
  converters: ConvertersOptions.TopLevel,
  justTypes: true,
  nicePropertyNames: false,
  declareUnions: false,
  preferConstValues: false,
  rawType: 'any',
  preferUnions: false,
  runtimeTypecheck: false,
  runtimeTypecheckIgnoreUnknownProperties: false,
};

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
   * The URI of the schema definition for the class, if available.
   */
  uri: string | undefined;

  /**
   * If the class declares itself as a constraint for another referenced class, this is the referenced type.
   */
  constraintFor: ClassType | undefined;

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
 * Base options for the `TypeScriptWithDecoratorsRenderer` language and renderer.
 */
export type TypeScriptWithDecoratorsOptions = {
  /**
   * The comment to add at the top of the generated file.
   */
  readonly leadingComment?: string;

  /**
   * Causa-level options for the generator and the decorators.
   */
  readonly generatorOptions?: Record<string, any>;

  /**
   * Model class schemas for looking up generated types.
   */
  readonly modelClassSchemas?: Record<string, GeneratedSchema>;
};

/**
 * A base {@link TypeScriptRenderer} that supports decorators.
 *
 * This renderer is meant to be subclassed by:
 * - Renderers that generate TypeScript code and support decorators on classes and properties.
 * - Renderers whose only job is to list decorators for a given TypeScript feature. For example, this could be
 *   validation decorators.
 *
 * **Decorator renderers should not define any other methods.** The way subclasses are meant to be used is to call
 * {@link TypeScriptWithDecoratorsRenderer.decoratorsForClass} and
 * {@link TypeScriptWithDecoratorsRenderer.decoratorsForProperty} against a base
 * {@link TypeScriptWithDecoratorsRenderer}.
 * This means subclasses should not hold a state nor define any other methods. However, they can call
 * {@link TypeScriptRenderer} (and {@link TypeScriptWithDecoratorsRenderer}) methods, which will let them access the
 * TypeScript code generation utilities. They can also retrieve options from
 * {@link TypeScriptWithDecoratorsRenderer.targetLanguage}.
 */
export abstract class TypeScriptWithDecoratorsRenderer<
  T extends TypeScriptWithDecoratorsOptions = TypeScriptWithDecoratorsOptions,
> extends TypeScriptRenderer {
  /**
   * The suffix used for constraint types.
   */
  protected readonly constraintSuffix: string;

  /**
   * The imports collected during the rendering process.
   * Keys are the import paths, and values are a set of symbols to import from the path.
   */
  protected readonly imports: Record<string, Set<string>> = {};

  /**
   * A placeholder for imports, emitted at the beginning of the file and filled when the rendering finishes.
   */
  private readonly importsPlaceholder: SourcelikeArray = [];

  constructor(
    readonly targetLanguage: TypeScriptWithDecoratorsTargetLanguage<T>,
    renderContext: RenderContext,
  ) {
    super(targetLanguage, renderContext, TSFLOW_OPTIONS);

    this.constraintSuffix =
      this.targetLanguage.options.generatorOptions?.constraintSuffix ??
      DEFAULT_CONSTRAINT_SUFFIX;
    if (typeof this.constraintSuffix !== 'string') {
      panic('The constraintSuffix option must be a string.');
    }
  }

  protected get needsTypeDeclarationBeforeUse(): boolean {
    return true;
  }

  protected canBeForwardDeclared(): boolean {
    return false;
  }

  /**
   * The logger to use for non-error messages.
   * Use `panic` from `quicktype-core` for errors.
   */
  protected get logger(): Logger {
    return this.targetLanguage.workspaceContext.logger;
  }

  /**
   * Ensures the given name ends with the constraint suffix, and removes it.
   *
   * @param name The name of the constraint type.
   * @returns The name without the constraint suffix.
   */
  protected removeConstraintSuffix(name: string): string {
    if (!name.endsWith(this.constraintSuffix)) {
      panic(
        `Constraint name '${name}' does not end with '${this.constraintSuffix}'.`,
      );
    }
    return name.slice(0, -this.constraintSuffix.length);
  }

  /**
   * Merges the given imports into the existing imports.
   * Keys are the import paths, and values are either a set of symbols or an array of symbols.
   *
   * @param imports The imports to merge into the existing imports.
   */
  protected addImports(imports: Record<string, Set<string> | string[]>): void {
    for (const [path, symbols] of Object.entries(imports)) {
      const existing = this.imports[path];
      if (!existing) {
        this.imports[path] = new Set(symbols);
        continue;
      }

      symbols.forEach((s) => existing.add(s));
    }
  }

  /**
   * Emits a placeholder for imports, which will be filled when the rendering finishes.
   */
  protected emitImportsPlaceholder(): void {
    this.emitItem(this.importsPlaceholder);
    this.emitLine();
  }

  /**
   * Fills the imports placeholder with the imports collected during rendering.
   */
  protected fillImportsPlaceholder(): void {
    const outputDir = dirname(this.targetLanguage.outputPath);

    Object.entries(this.imports)
      .toSorted(
        ([path1], [path2]) =>
          Number(path1.startsWith('/')) - Number(path2.startsWith('/')) ||
          path1.localeCompare(path2),
      )
      .forEach(([path, symbols]) => {
        if (path.startsWith('/')) {
          let relativePath = relative(outputDir, path);
          if (!relativePath.startsWith('.')) {
            relativePath = `.${sep}${relativePath}`;
          }
          path = relativePath.replace(/\.ts$/, '.js');
        }

        if (symbols.size === 0) {
          this.importsPlaceholder.push(`import '${path}';\n`);
        } else {
          const symbolsList = [...symbols]
            .filter((s) => !s.startsWith('type ') || !symbols.has(s.slice(5)))
            .toSorted()
            .join(', ');
          this.importsPlaceholder.push(
            `import { ${symbolsList} } from '${path}';\n`,
          );
        }
      });
  }

  /**
   * Constructs the {@link ClassContext} for the given class type.
   * Also returns the {@link CausaAttribute} for the class, which can be used to construct the
   * {@link ClassPropertyContext}.
   *
   * @param classType The type of the class.
   * @returns The {@link ClassContext}, along with the {@link CausaAttribute} for the class (if available).
   */
  protected contextForClassType(
    classType: ClassType,
  ): [ClassContext, CausaAttribute | undefined] {
    const causaAttributes = causaTypeAttributeKind.tryGetInAttributes(
      classType.getAttributes(),
    );

    const uri = causaAttributes?.uri;
    const objectAttributes = causaAttributes?.objectAttributes ?? {};

    let constraintFor: ClassType | undefined;
    if (objectAttributes.constraintFor) {
      const baseType = findTypeForUri(
        this.typeGraph,
        classType,
        objectAttributes.constraintFor,
      );
      if (!baseType || !(baseType instanceof ObjectType)) {
        panic(
          `Could not find base type for constraint '${classType.getCombinedName()}'.`,
        );
      }

      constraintFor = baseType;
    }

    return [
      { classType, uri, constraintFor, objectAttributes },
      causaAttributes,
    ];
  }

  /**
   * Constructs the {@link ClassPropertyContext} for the given property.
   *
   * @param name The name of the property.
   * @param jsonName The original name of the property in the schema.
   * @param property The property definition.
   * @param classContext The {@link ClassContext} of the parent class.
   * @param causaAttribute The {@link CausaAttribute} for the class, or `undefined` if not available.
   * @returns The {@link ClassPropertyContext} for the property.
   */
  protected contextForClassProperty(
    name: Name,
    jsonName: string,
    property: ClassProperty,
    classContext: ClassContext,
    causaAttribute: CausaAttribute | undefined,
  ): ClassPropertyContext {
    const propertyAttributes =
      causaAttribute?.propertiesAttributes[jsonName] ?? {};
    const isConst = causaAttribute?.constProperties.includes(jsonName) ?? false;
    return {
      ...classContext,
      name,
      jsonName,
      property,
      propertyAttributes,
      isConst,
    };
  }

  /**
   * Adds a type being emitted to the list of generated schemas.
   *
   * @param causaAttribute The {@link CausaAttribute} for the generated type (either a class or an enum).
   * @param generatedName The {@link Name} of the generated type, or a string (if it has already been looked up).
   */
  protected addGeneratedSchema(type: Type, generatedName: Name | string): void {
    const name =
      typeof generatedName === 'string'
        ? generatedName
        : this.names.get(generatedName);
    const causaAttribute = causaTypeAttributeKind.tryGetInAttributes(
      type.getAttributes(),
    );

    let uri = causaAttribute?.uri;
    if (!uri) {
      const identity = type.identity;
      if (!identity) {
        this.logger.warn(
          `Failed to find URI for generated schema '${name}' in Causa attribute.`,
        );
        return;
      }

      uri = `${HASH_CODE_PREFIX}${identity.hashCode()}`;
    }

    const file = this.targetLanguage.outputPath;
    if (!name) {
      panic(`Could not find name for generated schema '${uri}'.`);
    }

    this.targetLanguage.generatedSchemas[uri] = { name, file };
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
   * Finds the model class {@link GeneratedSchema} for a given class or enum type.
   *
   * @param type The type to find the model schema for.
   * @returns The {@link GeneratedSchema}.
   */
  protected findModelClassSchema(type: ClassType | EnumType): GeneratedSchema {
    const causaAttribute = causaTypeAttributeKind.tryGetInAttributes(
      type.getAttributes(),
    );
    const uri =
      causaAttribute?.uri ?? `${HASH_CODE_PREFIX}${type.identity?.hashCode()}`;

    const modelClassSchemas = this.targetLanguage.options.modelClassSchemas;
    if (!modelClassSchemas) {
      panic('No model class schemas found in target language options.');
    }

    const schema = modelClassSchemas[uri];
    if (!schema) {
      panic(
        `No model class schema found for URI '${uri}' in class type '${type.getCombinedName()}'. Ensure it is included in the model class generator input.`,
      );
    }

    return schema;
  }

  /**
   * Emits properties for a class type with custom logic for each property.
   * This method provides the common structure for iterating through properties while allowing subclasses to provide
   * custom logic for handling each property.
   *
   * @param context The class context.
   * @param propertyHandler A function that handles each property and returns the source code to emit.
   *   If `null` is returned, the property is skipped.
   */
  protected emitPropertiesWithHandler(
    context: ClassContext,
    propertyHandler: (context: ClassPropertyContext) => Sourcelike | null,
  ): void {
    const { classType: type, constraintFor: baseType } = context;
    const [, causaAttribute] = this.contextForClassType(type);

    const allProperties = new Map<string, ClassPropertyContext>();
    this.forEachClassProperty(type, 'none', (name, jsonName, property) =>
      allProperties.set(
        jsonName,
        this.contextForClassProperty(
          name,
          jsonName,
          property,
          context,
          causaAttribute,
        ),
      ),
    );

    if (baseType) {
      const [baseContext, baseCausaAttribute] =
        this.contextForClassType(baseType);

      this.forEachClassProperty(
        baseType,
        'none',
        (name, jsonName, property) => {
          if (!allProperties.has(jsonName)) {
            allProperties.set(
              jsonName,
              this.contextForClassProperty(
                name,
                jsonName,
                property,
                baseContext,
                baseCausaAttribute,
              ),
            );
          }
        },
      );
    }

    for (const context of allProperties.values()) {
      const sourceCode = propertyHandler(context);
      if (!sourceCode) {
        continue;
      }

      this.emitLine([context.name, ': ', sourceCode, ',']);
    }
  }

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

  protected makeEnumCaseNamer(): Namer {
    // This makes the TypeScript renderer support non-string enum cases and constants, even though they are not
    // officially supported by quicktype.
    return funPrefixNamer('enum-cases', (s) =>
      this.nameStyle(
        typeof s === 'string' ? s : `const_${(s as any).toString()}`,
        true,
      ),
    );
  }
}
