import {
  causaTypeAttributeKind,
  findTypeForUri,
} from '@causa/workspace-core/code-generation';
import {
  ArrayType,
  ClassProperty,
  ClassType,
  EnumType,
  Name,
  ObjectType,
  panic,
  type RenderContext,
  type Sourcelike,
  Type,
  UnionType,
} from 'quicktype-core';
import type { SourcelikeArray } from 'quicktype-core/dist/Source.js';
import {
  descriptionTypeAttributeKind,
  propertyDescriptionsTypeAttributeKind,
} from 'quicktype-core/dist/attributes/Description.js';
import type { TypeScriptDecorator } from '../decorator.js';
import type { TypeScriptWithDecoratorsTargetLanguage } from '../language.js';
import {
  type ClassPropertyContext,
  TypeScriptWithDecoratorsRenderer,
} from '../renderer.js';
import type { TypeScriptModelClassOptions } from './options.js';

/**
 * A renderer that generates TypeScript classes with decorators.
 *
 * {@link TypeScriptWithDecoratorsRenderer} is subclassed instead of `TypeScriptRenderer` only to provide utility methods to
 * decorators renderers.
 */
export class TypeScriptModelClassRenderer extends TypeScriptWithDecoratorsRenderer<TypeScriptModelClassOptions> {
  /**
   * The list of {@link TypeScriptWithDecoratorsRenderer.decoratorsForClass} functions, bound to this renderer.
   */
  private readonly classDecoratorRenderers: TypeScriptWithDecoratorsRenderer['decoratorsForClass'][];

  /**
   * The list of {@link TypeScriptWithDecoratorsRenderer.decoratorsForProperty} functions, bound to this renderer.
   */
  private readonly propertyDecoratorRenderers: TypeScriptWithDecoratorsRenderer['decoratorsForProperty'][];

  /**
   * Whether to add non-null assertions (`!`) on class properties.
   */
  readonly nonNullAssertionOnProperties: boolean;

  /**
   * Whether to add the `readonly` keyword to class properties.
   */
  readonly readonlyProperties: boolean;

  /**
   * Whether to add an "assign" constructor to model classes.
   */
  readonly assignConstructor: boolean;

  /**
   * Creates a new TypeScript renderer.
   *
   * @param targetLanguage The target language.
   * @param context The render context.
   * @param logger The logger to use for non-error messages.
   * @param options Options for the renderer.
   */
  constructor(
    targetLanguage: TypeScriptWithDecoratorsTargetLanguage<TypeScriptModelClassOptions>,
    context: RenderContext,
  ) {
    super(targetLanguage, context);

    const { options } = targetLanguage;
    const renderers = (options.decoratorRenderers ?? []).map(
      (r) => r.prototype as TypeScriptWithDecoratorsRenderer,
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
  }

  decoratorsForClass(): TypeScriptDecorator[] {
    return [];
  }

  decoratorsForProperty(): TypeScriptDecorator[] {
    return [];
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
   * Emits a `type` which is the intersection of the base type and the constraint type.
   *
   * @param baseName The name of the base type being constrained.
   * @param constraintName The name of the constraint type.
   * @returns The name given to the intersection type that combines the base type and the constraint.
   */
  protected emitConstrainedClassType(
    baseName: Name,
    constraintName: Name,
  ): string {
    const constraintString = this.names.get(constraintName);
    if (!constraintString) {
      panic('Could not find name for constraint.');
    }

    const constrainedClassName = this.removeConstraintSuffix(constraintString);

    this.emitLine([
      'export type ',
      constrainedClassName,
      ' = ',
      baseName,
      ' & ',
      constraintName,
      ';',
    ]);

    return constrainedClassName;
  }

  // This is overridden to:
  // - Create a `class` rather than a `type` or `interface`.
  // - Add decorators to the class, using the decorator renderers.
  // - Emit a class constructor before the rest of the body.
  // - Track the generated class in `generatedSchemas`.
  // - Emit an additional type when the class is marked as being a constraint for another type.
  protected emitClassBlock(classType: ClassType, className: Name): void {
    const [context, causaAttribute] = this.contextForClassType(classType);

    if (context.constraintFor) {
      const constrainedClassName = this.emitConstrainedClassType(
        this.nameForNamedType(context.constraintFor),
        className,
      );
      this.ensureBlankLine();
      this.emitDescription(this.descriptionForType(classType));

      this.addGeneratedSchema(causaAttribute, constrainedClassName);
    } else {
      this.addGeneratedSchema(causaAttribute, className);
    }

    [
      ...(context.objectAttributes.tsDecorators ?? []),
      ...this.classDecoratorRenderers.flatMap((renderer) => renderer(context)),
    ].forEach(({ source, imports }) => {
      this.addImports(imports);
      this.emitLine(source);
    });

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

  /**
   * Renders the source for the property type.
   * This is heavily based on {@link TypeScriptWithDecoratorsRenderer.sourceFor}, however it includes Causa-specific logic,
   * like enum hints and constant values.
   *
   * @param context The {@link ClassPropertyContext} for the property.
   * @returns The source for the property type.
   */
  protected sourceForPropertyType(context: ClassPropertyContext): Sourcelike {
    const {
      property: { type },
      propertyAttributes,
      classType,
      jsonName,
      isConst,
      constraintFor,
    } = context;
    if (isConst) {
      let enumType: EnumType | undefined;
      if (type instanceof EnumType) {
        enumType = type;
      } else if (type instanceof UnionType) {
        enumType = type.findMember('enum') as EnumType | undefined;
      }

      const constValue = enumType?.cases.values().next().value;
      if (constValue !== undefined) {
        const basePropertyType = constraintFor
          ?.getProperties()
          .get(jsonName)?.type;
        if (basePropertyType instanceof EnumType) {
          const enumName = this.nameForNamedType(basePropertyType);
          const caseName = this.nameForEnumCase(basePropertyType, constValue);
          return [enumName, '.', caseName];
        }

        return JSON.stringify(constValue);
      }
    }

    const baseType = this.sourceFor(type).source;
    const { enumHint } = propertyAttributes;
    if (!enumHint) {
      return baseType;
    }

    if (typeof enumHint !== 'string') {
      panic(`Invalid enum hint for property '${context.jsonName}'.`);
    }

    const enumType = findTypeForUri(this.typeGraph, classType, enumHint);
    if (!enumType) {
      this.logger.warn(
        `Could not find type for enum hint '${enumHint}' in property '${jsonName}'.`,
      );
      return baseType;
    }

    const enumSource = this.sourceFor(enumType).source;

    if (type.kind === 'array') {
      const arrayType = type as ArrayType;
      const itemSource = this.sourceFor(arrayType.items).source;
      return ['(', itemSource, ' | ', enumSource, ')[]'];
    }

    return [baseType, ' | ', enumSource];
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
    const [classContext, causaAttribute] = this.contextForClassType(classType);

    this.forEachClassProperty(classType, 'none', (name, jsonName, property) => {
      this.ensureBlankLine();

      const context = this.contextForClassProperty(
        name,
        jsonName,
        property,
        classContext,
        causaAttribute,
      );

      const description = this.descriptionForClassProperty(classType, jsonName);
      if (description) {
        this.emitDescription(description);
      }

      [
        ...(context.propertyAttributes.tsDecorators ?? []),
        ...this.propertyDecoratorRenderers.flatMap((renderer) =>
          renderer(context),
        ),
      ].forEach(({ source, imports }) => {
        this.addImports(imports);
        this.emitLine(source);
      });

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

        const typeSource = tsType ?? this.sourceForPropertyType(context);
        const defaultAssignment = tsDefault ? [' = ', tsDefault] : [];
        row[1] = [typeSource, ...defaultAssignment, ';'];
      }

      // The custom `emitTable` behavior of the parent class does not really make sense in this case.
      // Here, `emitTable` is simply called for each property.
      this.emitTable([row]);
    });
  }

  /**
   * Checks whether the given enum should be emitted.
   * An enum should not be emitted if it is actually a constant property of a class.
   *
   * If at least one of the parents of the enum is not a class, or the property using the enum is not a constant, then
   * the enum should be emitted. Otherwise, it should not.
   *
   * @param e The enum type to check.
   * @returns Whether the enum should be emitted.
   */
  protected shouldEmitEnum(e: EnumType): boolean {
    const parents = this.typeGraph.getParentsOfType(e);
    if (parents.size === 0) {
      return true;
    }

    // If the enum itself has Causa attributes, it is an `enum` in the raw schema definition, so it should be emitted.
    const causaAttribute = causaTypeAttributeKind.tryGetInAttributes(
      e.getAttributes(),
    );
    if (causaAttribute) {
      return true;
    }

    for (const parent of parents) {
      if (parent instanceof UnionType) {
        // This can occur for const enums that are also a primitive type, e.g. a boolean.
        continue;
      }

      if (!(parent instanceof ClassType)) {
        return true;
      }

      const constProperties = causaTypeAttributeKind.tryGetInAttributes(
        parent.getAttributes(),
      )?.constProperties;
      if (!constProperties) {
        return true;
      }

      for (const [jsonName, property] of parent.getProperties()) {
        if (property.type !== e) {
          continue;
        }

        if (!constProperties.includes(jsonName)) {
          return true;
        }
      }
    }

    return false;
  }

  // This is overridden to avoid emitting the enum if it is a constant property of a class.
  // Also tracks the generated enum in `generatedSchemas`.
  protected emitEnum(e: EnumType, enumName: Name): void {
    if (!this.shouldEmitEnum(e)) {
      return;
    }

    const causaAttribute = causaTypeAttributeKind.tryGetInAttributes(
      e.getAttributes(),
    );
    this.addGeneratedSchema(causaAttribute, enumName);

    return super.emitEnum(e, enumName);
  }

  // This is overridden to:
  // - Emit the imports required by the decorators.
  // - Avoid emitting the conversion utilities and the CommonJS module exports.
  protected emitSourceStructure(): void {
    if (this.targetLanguage.options.leadingComment) {
      this.emitCommentLines(
        this.targetLanguage.options.leadingComment.split('\n'),
      );
      this.ensureBlankLine();
    }

    this.emitImportsPlaceholder();

    this.emitTypes();

    this.fillImportsPlaceholder();
  }
}
