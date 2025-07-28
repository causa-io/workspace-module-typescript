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
    this.emitPropertiesWithHandler(
      context,
      (_, { type }, isConst) => this.defaultValueForType(type, { isConst })[0],
    );
  }

  /**
   * Generates a default value for a given type.
   *
   * @param type The type to generate a default value for.
   * @param options Options when generating the default value.
   * @returns A tuple containing the source code for the default value and required imports.
   */
  protected defaultValueForType(
    type: Type,
    options: {
      /**
       * If true, the default value will be the raw enum case value instead of a reference to the enum.
       */
      isConst?: boolean;
    } = {},
  ): [Sourcelike, Record<string, Set<string>>] {
    const [hasNull, nonNullType] = removeNullFromType(type);
    if (hasNull) {
      return ['null', {}];
    }
    if (nonNullType.size === 0) {
      panic(
        `Cannot generate default value for type '${type.kind}' with no non-null types.`,
      );
    }

    const singleType = [...nonNullType][0];

    if (nonNullType.size > 1) {
      return this.defaultValueForType(singleType);
    }

    switch (singleType.kind) {
      case 'string':
        return ["'string'", {}];
      case 'integer':
        return ['0', {}];
      case 'double':
        return ['0.0', {}];
      case 'bool':
        return ['false', {}];
      case 'date':
      case 'date-time':
        return ['new Date()', {}];
      case 'uuid':
        return ['randomUUID()', { crypto: new Set(['randomUUID']) }];
      case 'array':
        return ['[]', {}];
      case 'map':
        return ['{}', {}];
      case 'class':
        return [
          [this.getFunctionNameForClassType(singleType as ClassType), '()'],
          {},
        ];
      case 'enum':
        const enumType = singleType as EnumType;
        const firstCase = enumType.cases.values().next().value;
        if (!firstCase) {
          panic(`Enum type '${enumType.getCombinedName()}' has no cases.`);
        }

        if (options.isConst) {
          return [JSON.stringify(firstCase), {}];
        }

        const firstCaseName = this.nameForEnumCase(enumType, firstCase);
        const { name: enumName } = this.findModelClassSchema(enumType);
        return [[enumName, '.', firstCaseName], {}];
      default:
        this.logger.warn(
          `Unsupported type '${singleType.kind}' for default value generation.`,
        );
        return ["'unknown'", {}];
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

    const { name: modelClassName } = this.findModelClassSchema(classType);

    const [context] = this.contextForClassType(classType);
    const { constraintFor } = context;
    const instantiationClassName = constraintFor
      ? this.findModelClassSchema(constraintFor).name
      : modelClassName;

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

  /**
   * Collects utility imports required by analyzing all types and their properties.
   *
   * @returns A record mapping package names to sets of symbols to import.
   */
  protected collectUtilityImports(): Record<string, Set<string>> {
    const imports: Record<string, Set<string>> = {};

    this.forEachObject('none', (classType) => {
      const [{ constraintFor }, causaAttribute] =
        this.contextForClassType(classType);
      const properties = [
        ...classType.getProperties(),
        ...(constraintFor?.getProperties() ?? []),
      ];

      for (const [jsonName, { type }] of properties) {
        const [, propertyImports] = this.defaultValueForType(type, {
          isConst: causaAttribute?.constProperties.includes(jsonName),
        });
        this.mergeImports(imports, propertyImports);
      }
    });

    return imports;
  }

  /**
   * Collects imports for model classes.
   *
   * @returns A record mapping import paths to sets of names to import.
   */
  protected collectModelClassImports(): Record<string, Set<string>> {
    return this.collectModelClassImportsWithFilter();
  }

  // Override to emit imports and make functions
  protected emitSourceStructure(): void {
    if (this.targetLanguage.options.leadingComment) {
      this.emitCommentLines(
        this.targetLanguage.options.leadingComment.split('\n'),
      );
      this.ensureBlankLine();
    }

    this.emitImports(this.collectUtilityImports());
    this.emitImports(this.collectModelClassImports());

    this.emitTypes();
  }
}
