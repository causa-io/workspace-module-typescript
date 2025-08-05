import {
  ClassType,
  EnumType,
  panic,
  Type,
  type Sourcelike,
} from 'quicktype-core';
import { removeNullFromType } from 'quicktype-core/dist/Type/index.js';
import {
  TypeScriptWithDecoratorsRenderer,
  type ClassContext,
} from '../renderer.js';
import type { TypeScriptTestObjectOptions } from './options.js';

/**
 * A renderer that generates TypeScript utility functions to create test objects.
 */
export class TypeScriptTestObjectRenderer extends TypeScriptWithDecoratorsRenderer<TypeScriptTestObjectOptions> {
  decoratorsForClass(): [] {
    return [];
  }

  decoratorsForProperty(): [] {
    return [];
  }

  /**
   * Constructs the function name for a class type.
   *
   * @param classType The class type to generate a function name for.
   * @returns The function name for the class type, e.g., `makeClassName`.
   */
  protected getFunctionNameForClassType(classType: ClassType): string {
    const className = this.nameForNamedType(classType);
    const classNameStr = this.names.get(className);
    if (!classNameStr) {
      panic(
        `Could not find name for class type '${classType.getCombinedName()}'.`,
      );
    }

    const [context] = this.contextForClassType(classType);

    const nameForFunction = context.constraintFor
      ? this.removeConstraintSuffix(classNameStr)
      : classNameStr;

    return `make${nameForFunction}`;
  }

  /**
   * Emits properties for the given type, mapping them to their default values.
   * If the type is a constraint type, the base type (`constraintFor`) is used to also emit properties from the base
   * type when they do not exist in the constraint type.
   *
   * @param context The context containing the class type and other information.
   */
  protected emitProperties(context: ClassContext): void {
    this.emitPropertiesWithHandler(context, (jsonName, { type }, isConst) =>
      this.defaultValueForType(type, context, jsonName, isConst),
    );
  }

  /**
   * Generates a default value for a given type.
   *
   * @param type The type to generate a default value for.
   * @param context The context for the parent class.
   * @param jsonName The JSON name of the property.
   * @param isConst Whether the property is a constant.
   * @returns The source code for the default value.
   */
  protected defaultValueForType(
    type: Type,
    context: ClassContext,
    jsonName: string,
    isConst: boolean,
  ): Sourcelike {
    const [hasNull, nonNullType] = removeNullFromType(type);
    if (hasNull) {
      return 'null';
    }
    if (nonNullType.size === 0) {
      panic(
        `Cannot generate default value for type '${type.kind}' with no non-null types.`,
      );
    }

    const singleType = [...nonNullType][0];

    switch (singleType.kind) {
      case 'string':
        return "'string'";
      case 'integer':
        return '0';
      case 'double':
        return '0.0';
      case 'bool':
        return 'false';
      case 'date':
      case 'date-time':
        return 'new Date()';
      case 'uuid':
        this.addImports({ crypto: ['randomUUID'] });
        return 'randomUUID()';
      case 'array':
        return '[]';
      case 'map':
        return '{}';
      case 'class':
        return [
          this.getFunctionNameForClassType(singleType as ClassType),
          '()',
        ];
      case 'enum':
        let enumType = singleType as EnumType;
        const firstCase = enumType.cases.values().next().value;
        if (!firstCase) {
          panic(`Enum type '${enumType.getCombinedName()}' has no cases.`);
        }

        if (isConst) {
          const basePropertyType = context.constraintFor
            ?.getProperties()
            .get(jsonName)?.type;
          if (!(basePropertyType instanceof EnumType)) {
            return JSON.stringify(firstCase);
          }

          enumType = basePropertyType;
        }

        const firstCaseName = this.nameForEnumCase(enumType, firstCase);
        const { name: enumName, file } = this.findModelClassSchema(enumType);
        this.addImports({ [file]: [enumName] });
        return [enumName, '.', firstCaseName];
      default:
        this.logger.warn(
          `Unsupported type '${singleType.kind}' for default value generation.`,
        );
        return "'unknown'";
    }
  }

  /**
   * Emits a make function for a class type.
   *
   * @param classType The class type.
   * @param className The name of the class.
   */
  protected emitMakeFunction(classType: ClassType): string {
    const functionName = this.getFunctionNameForClassType(classType);

    const { name: modelClassName, file: modelClassFile } =
      this.findModelClassSchema(classType);

    const [context] = this.contextForClassType(classType);
    const { constraintFor } = context;

    let instantiationClassName: string;
    if (constraintFor) {
      const { name, file } = this.findModelClassSchema(constraintFor);
      instantiationClassName = name;
      this.addImports({
        [file]: [name],
        [modelClassFile]: [`type ${modelClassName}`],
      });
    } else {
      instantiationClassName = modelClassName;
      this.addImports({ [modelClassFile]: [modelClassName] });
    }

    this.emitBlock(
      [
        'export function ',
        functionName,
        '(data: Partial<',
        modelClassName,
        '> = {}): ',
        modelClassName,
      ],
      '',
      () => {
        this.emitLine(['return new ', instantiationClassName, '({']);
        this.emitProperties(context);
        this.emitLine('...data,');
        const cast = constraintFor ? [' as ', modelClassName] : [];
        this.emitLine(['})', ...cast, ';']);
      },
    );

    return functionName;
  }

  protected emitClassBlock(classType: ClassType): void {
    this.ensureBlankLine();
    const functionName = this.emitMakeFunction(classType);

    const [, causaAttribute] = this.contextForClassType(classType);
    this.addGeneratedSchema(causaAttribute, functionName);
  }

  // Don't emit descriptions.
  protected emitDescription(): void {}

  // Don't emit enums.
  protected emitEnum(): void {}

  // Override to emit imports and make functions
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
