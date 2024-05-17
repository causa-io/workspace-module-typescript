import {
  CausaPropertyAttributes,
  causaTypeAttributeKind,
} from '@causa/workspace-core';
import {
  ClassProperty,
  ClassType,
  Name,
  ObjectType,
  OptionValues,
  RenderContext,
  Sourcelike,
  TargetLanguage,
  Type,
  tsFlowOptions,
} from 'quicktype-core';
import { SourcelikeArray } from 'quicktype-core/dist/Source.js';
import {
  descriptionTypeAttributeKind,
  propertyDescriptionsTypeAttributeKind,
} from 'quicktype-core/dist/attributes/Description.js';
import { AcronymStyleOptions } from 'quicktype-core/dist/support/Acronyms.js';
import { ConvertersOptions } from 'quicktype-core/dist/support/Converters.js';
import { TypeScriptDecorator } from './decorator.js';
import {
  ClassContext,
  ClassPropertyContext,
  TypeScriptDecoratorsRenderer,
} from './ts-decorators-renderer.js';

/**
 * Options for the {@link TypeScriptWithDecoratorsRenderer}.
 */
export type TypeScriptWithDecoratorsRendererOptions = {
  /**
   * A list of decorators renderers that can add decorators to classes and their properties.
   */
  readonly decoratorRenderers?: {
    new (...args: any[]): TypeScriptDecoratorsRenderer;
  }[];

  /**
   * Whether to add non-null assertions (`!`) on class properties.
   * Defaults to `true`.
   */
  readonly nonNullAssertionOnProperties?: boolean;

  /**
   * Whether to add the `readonly` keyword to class properties.
   * Defaults to `true`.
   */
  readonly readonlyProperties?: boolean;

  /**
   * Whether to add an “assign” constructor to model classes.
   * Defaults to `true`.
   */
  readonly assignConstructor?: boolean;

  /**
   * The comment to add at the top of the generated file.
   */
  readonly leadingComment?: string;

  /**
   * Options for decorator renderers.
   */
  readonly decoratorOptions?: Record<string, any>;
};

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
 * A renderer that generates TypeScript classes with decorators.
 *
 * {@link TypeScriptDecoratorsRenderer} is subclassed instead of `TypeScriptRenderer` only to provide utility methods to
 * decorators renderers.
 */
export class TypeScriptWithDecoratorsRenderer extends TypeScriptDecoratorsRenderer {
  /**
   * The list of {@link TypeScriptDecoratorsRenderer.decoratorsForClass} functions, bound to this renderer.
   */
  private readonly classDecoratorRenderers: TypeScriptDecoratorsRenderer['decoratorsForClass'][];

  /**
   * The list of {@link TypeScriptDecoratorsRenderer.decoratorsForProperty} functions, bound to this renderer.
   */
  private readonly propertyDecoratorRenderers: TypeScriptDecoratorsRenderer['decoratorsForProperty'][];

  /**
   * Whether to add non-null assertions (`!`) on class properties.
   */
  readonly nonNullAssertionOnProperties: boolean;

  /**
   * Whether to add the `readonly` keyword to class properties.
   */
  readonly readonlyProperties: boolean;

  /**
   * Whether to add an “assign” constructor to model classes.
   */
  readonly assignConstructor: boolean;

  /**
   * The comment to add at the top of the generated file.
   */
  readonly leadingComment?: string;

  /**
   * Creates a new TypeScript renderer.
   *
   * @param targetLanguage The target language.
   * @param context The render context.
   * @param options Options for the renderer.
   */
  constructor(
    targetLanguage: TargetLanguage,
    context: RenderContext,
    options: TypeScriptWithDecoratorsRendererOptions = {},
  ) {
    super(
      targetLanguage,
      context,
      TSFLOW_OPTIONS,
      options.decoratorOptions ?? {},
    );

    const renderers = (options.decoratorRenderers ?? []).map(
      (r) => r.prototype as TypeScriptDecoratorsRenderer,
    );
    this.classDecoratorRenderers = renderers.map((r) =>
      r.decoratorsForClass.bind(this),
    );
    this.propertyDecoratorRenderers = renderers.map((r) =>
      r.decoratorsForProperty.bind(this),
    );
    this.nonNullAssertionOnProperties =
      options.nonNullAssertionOnProperties ?? true;
    this.readonlyProperties = options.readonlyProperties ?? true;
    this.assignConstructor = options.assignConstructor ?? true;
    this.leadingComment = options.leadingComment;
  }

  decoratorsForClass(): TypeScriptDecorator[] {
    return [];
  }

  decoratorsForProperty(): TypeScriptDecorator[] {
    return [];
  }

  protected get needsTypeDeclarationBeforeUse(): boolean {
    return true;
  }

  protected canBeForwardDeclared(): boolean {
    return false;
  }

  /**
   * Emits a class constructor that assigns the given object to the instance.
   *
   * @param className The name of the generated class.
   */
  protected emitClassConstructor(className: Name): void {
    this.emitBlock(['constructor(init: ', className, ')'], '', () => {
      this.emitLine('Object.assign(this, init);');
    });
  }

  /**
   * Constructs the {@link ClassContext} for the given class type.
   * Also returns the dictionary of property attributes for the class, which can be used to construct the
   * {@link ClassPropertyContext}.
   *
   * @param classType The type of the class.
   * @returns The {@link ClassContext}, along with the dictionary of property attributes.
   */
  protected contextForClassType(
    classType: ClassType,
  ): [ClassContext, Record<string, CausaPropertyAttributes>] {
    const causaAttributes = causaTypeAttributeKind.tryGetInAttributes(
      classType.getAttributes(),
    );

    return [
      {
        classType,
        objectAttributes: causaAttributes?.objectAttributes ?? {},
      },
      causaAttributes?.propertiesAttributes ?? {},
    ];
  }

  // This is overridden to:
  // - Create a `class` rather than a `type` or `interface`.
  // - Add decorators to the class, using the decorator renderers.
  // - Emit a class constructor before the rest of the body.
  protected emitClassBlock(classType: ClassType, className: Name): void {
    const [context] = this.contextForClassType(classType);

    [
      ...(context.objectAttributes.tsDecorators ?? []),
      ...this.classDecoratorRenderers.flatMap((renderer) => renderer(context)),
    ].forEach((d) => this.emitLine(d.source));

    this.emitBlock(['export class ', className, ' '], '', () => {
      if (this.assignConstructor) {
        this.emitClassConstructor(className);
      }

      this.emitClassBlockBody(classType);
    });
  }

  // This is overridden to avoid returning the concatenated descriptions for a type.
  // The JSONSchema input will merge the description for a type with the descriptions of all the properties where the
  // type is used into a single set.
  // Although this is undocumented behavior, the description for the type can be found at the last position of the set.
  // This also bypasses the hardcoded word wrap behavior of the base class.
  protected descriptionForType(t: Type): string[] | undefined {
    const description = this.typeGraph.attributeStore.tryGet(
      descriptionTypeAttributeKind,
      t,
    );
    const typeDescription = [...(description ?? [])].at(-1);
    if (!typeDescription) {
      return undefined;
    }

    return typeDescription.split('\n').map((l) => l.trim());
  }

  // This bypasses the hardcoded word wrap behavior of the base class.
  protected descriptionForClassProperty(
    o: ObjectType,
    name: string,
  ): string[] | undefined {
    const propertiesDescriptions = this.typeGraph.attributeStore.tryGet(
      propertyDescriptionsTypeAttributeKind,
      o,
    );
    const propertyDescription = propertiesDescriptions?.get(name);
    if (!propertyDescription) {
      return undefined;
    }

    return [...propertyDescription]
      .join('\n\n')
      .split('\n')
      .map((l) => l.trim());
  }

  // This is overridden to emit the decorators for each property.
  // Unfortunately, the base class makes it difficult to override the behavior, so we have to rely on internal
  // implementations that may break at some point.
  protected emitPropertyTable(
    classType: ClassType,
    makePropertyRow: (
      name: Name,
      jsonName: string,
      p: ClassProperty,
    ) => Sourcelike[],
  ): void {
    const [classContext, propertiesAttributes] =
      this.contextForClassType(classType);

    this.forEachClassProperty(classType, 'none', (name, jsonName, property) => {
      this.ensureBlankLine();

      const context: ClassPropertyContext = {
        ...classContext,
        name,
        jsonName,
        property,
        propertyAttributes: propertiesAttributes[jsonName] ?? {},
      };

      const description = this.descriptionForClassProperty(classType, jsonName);
      if (description) {
        this.emitDescription(description);
      }

      [
        ...(context.propertyAttributes.tsDecorators ?? []),
        ...this.propertyDecoratorRenderers.flatMap((renderer) =>
          renderer(context),
        ),
      ].forEach((d) => this.emitLine(d.source));

      // This makes a lot of assumptions about what `makePropertyRow` returns.
      // Unfortunately, it cannot be fully replaced by a custom implementation because `quotePropertyName` is not
      // exported by quicktype.
      // The expected row should have the following format:
      // [
      //   [<propertyName>, '?' | '', ': '],
      //   [<typeSource>, ';'],
      // ]
      const row = makePropertyRow(name, jsonName, property);
      if (Array.isArray(row) && Array.isArray(row[0])) {
        const { tsDefault, tsType } = context.propertyAttributes;
        const propertySource: SourcelikeArray = row[0];
        if (tsDefault) {
          propertySource[1] = '';
        } else if (
          this.nonNullAssertionOnProperties &&
          propertySource[1] === ''
        ) {
          propertySource[1] = '!';
        }

        if (this.readonlyProperties) {
          propertySource.unshift('readonly ');
        }

        const typeSource = tsType ?? this.sourceFor(property.type).source;
        const defaultAssignment = tsDefault ? [' = ', tsDefault] : [];
        row[1] = [typeSource, ...defaultAssignment, ';'];
      }

      // The custom `emitTable` behavior of the parent class does not really make sense in this case.
      // Here, `emitTable` is simply called for each property.
      this.emitTable([row]);
    });
  }

  /**
   * Emits the imports for the decorators used in the generated classes.
   */
  protected emitDecoratorImports(): void {
    const imports: Record<string, Set<string>> = {};
    function addImports(decoratorImports: Record<string, string[]>) {
      Object.entries(decoratorImports).forEach(([modulePath, symbols]) => {
        if (!imports[modulePath]) {
          imports[modulePath] = new Set();
        }

        const symbolsSet = imports[modulePath];
        symbols.forEach((symbol) => symbolsSet.add(symbol));
      });
    }

    this.forEachObject('none', (classType) => {
      const [classContext, propertiesAttributes] =
        this.contextForClassType(classType);

      classContext.objectAttributes.tsDecorators?.forEach((d) =>
        addImports(d.imports),
      );
      this.classDecoratorRenderers
        .flatMap((renderer) => renderer(classContext))
        .forEach((d) => addImports(d.imports));

      this.forEachClassProperty(
        classType,
        'none',
        (name, jsonName, property) => {
          const context: ClassPropertyContext = {
            ...classContext,
            name,
            jsonName,
            property,
            propertyAttributes: propertiesAttributes[jsonName] ?? {},
          };

          this.propertyDecoratorRenderers
            .flatMap((renderer) => renderer(context))
            .map((d) => addImports(d.imports));

          context.propertyAttributes.tsDecorators?.forEach((d) =>
            addImports(d.imports),
          );
        },
      );
    });

    Object.entries(imports).forEach(([modulePath, symbols]) => {
      const symbolsList = [...symbols].join(', ');
      this.emitLine(`import { ${symbolsList} } from '${modulePath}';`);
    });
  }

  // This is overridden to:
  // - Emit the imports required by the decorators.
  // - Avoid emitting the conversion utilities and the CommonJS module exports.
  protected emitSourceStructure(): void {
    if (this.leadingComment) {
      this.emitCommentLines(this.leadingComment.split('\n'));
      this.ensureBlankLine();
    }

    this.emitDecoratorImports();

    this.emitTypes();
  }
}
