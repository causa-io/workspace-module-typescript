import { EnumType, MapType, Type, type TypeKind } from 'quicktype-core';
import type {
  Sourcelike,
  SourcelikeArray,
} from 'quicktype-core/dist/Source.js';
import type { TypeScriptDecorator } from '../decorator.js';
import {
  type ClassContext,
  type ClassPropertyContext,
  TypeScriptDecoratorsRenderer,
} from '../ts-decorators-renderer.js';
import { getSingleType } from '../utilities.js';

/**
 * The name of the module that exports OpenAPI decorators.
 */
const NESTJS_SWAGGER_MODULE = '@nestjs/swagger';

/**
 * The name of the Causa attribute that should be present for a class to be decorated with OpenAPI decorators.
 */
const OPENAPI_ATTRIBUTE = 'tsOpenApi';

/**
 * A map between quicktype type kinds and the corresponding JSON schema types.
 */
const TYPE_KIND_TO_JSONSCHEMA_TYPE: Partial<Record<TypeKind, string>> = {
  string: 'string',
  date: 'string',
  'date-time': 'string',
  uuid: 'string',
  integer: 'integer',
  double: 'number',
  bool: 'boolean',
  map: 'object',
  // Only string enums are supported by Quicktype.
  enum: 'string',
};

/**
 * Generates the source code for the `@ApiProperty` decorator options for the given type.
 * This function is recursive, and will generate options for array types as well.
 *
 * @param type The type for which the decorator options should be generated.
 * @param options Additional options when generating the code.
 * @returns The source code for the decorator options.
 */
function typeToDecoratorOptions(
  type: Type,
  options: {
    /**
     * Whether the type is the item of an array.
     */
    isArrayItem?: boolean;

    /**
     * Whether the type is required.
     * This should be set for "decorator-level" types (i.e. that will be directly added to the `@ApiProperty`
     * decorator).
     */
    required?: boolean;
  } = {},
): SourcelikeArray {
  const { isArrayItem, required } = options;
  const singleTypeInfo = getSingleType(type);
  if (!singleTypeInfo) {
    return [];
  }

  const { type: singleType, isNullable, isArray } = singleTypeInfo;
  let decoratorOptions: SourcelikeArray = [];
  // If `required` is set, add it to the options using the `required` property.
  // This is how it should be done except for the `object` type.
  let requiredOption: Sourcelike | undefined =
    required !== undefined ? `required: ${required}, ` : undefined;

  if (isArray) {
    const itemOptions = typeToDecoratorOptions(singleType, {
      isArrayItem: true,
    });
    decoratorOptions.push(`type: 'array', `, 'items: { ', itemOptions, ' }, ');
  } else {
    const jsonSchemaType = TYPE_KIND_TO_JSONSCHEMA_TYPE[singleType.kind];
    if (jsonSchemaType) {
      decoratorOptions.push(`type: '${jsonSchemaType}', `);
    }
    switch (singleType.kind) {
      case 'date':
      case 'date-time':
      case 'uuid':
        decoratorOptions.push(`format: '${singleType.kind}', `);
        break;
      case 'enum':
        const cases = [...(singleType as EnumType).cases];
        decoratorOptions.push(`enum: ${JSON.stringify(cases)}, `);
        break;
      case 'class':
        // If the type is not nullable and is not a nested item (i.e. in an array), NestJS will automatically infer the
        // type and declare it using `allOf`. Other type information should not be added in the decorator.
        if (!isNullable && !isArrayItem) {
          break;
        }

        const typeName = singleType.getCombinedName();
        decoratorOptions.push(`$ref: getSchemaPath(${typeName})`);
        break;
      case 'map':
        // For `object` types, the `@ApiProperty` decorator `required` option is ambiguous and `selfRequired` must be
        // used instead.
        if (requiredOption) {
          requiredOption = `selfRequired: ${required}, `;
        }

        const additionalProperties = (
          singleType as MapType
        ).getAdditionalProperties();
        if (additionalProperties) {
          const options = typeToDecoratorOptions(additionalProperties);
          if (options.length > 0) {
            decoratorOptions.push('additionalProperties: { ', options, ' }, ');
          } else {
            // This can for example occur if the additional properties are of type `any`.
            decoratorOptions.push('additionalProperties: true, ');
          }
        }
        break;
    }
  }

  if (isNullable) {
    decoratorOptions = ['oneOf: [{', decoratorOptions, `}, { type: 'null' }],`];
  }

  if (requiredOption) {
    decoratorOptions.splice(0, 0, requiredOption);
  }

  return decoratorOptions;
}

/**
 * Returns the name of the class used by the given type, or an empty array if it is a basic type.
 *
 * @param type The property type that may be a class, or contain a class within an array.
 * @returns The list of classes used by the type.
 */
function listReferencedClasses(type: Type): string[] {
  const singleTypeInfo = getSingleType(type);
  if (!singleTypeInfo) {
    return [];
  }

  if (singleTypeInfo.isArray) {
    return listReferencedClasses(singleTypeInfo.type);
  }

  return singleTypeInfo.type.kind === 'class'
    ? [singleTypeInfo.type.getCombinedName()]
    : [];
}

/**
 * A {@link TypeScriptDecoratorsRenderer} that renders NestJS OpenAPI decorators.
 * Decorators are only added if the type schema has the `tsOpenApi` Causa attribute.
 */
export class OpenApiRenderer extends TypeScriptDecoratorsRenderer {
  decoratorsForClass(context: ClassContext): TypeScriptDecorator[] {
    if (!context.objectAttributes[OPENAPI_ATTRIBUTE]) {
      return [];
    }

    const references = new Set<string>();
    for (const propType of context.classType.getProperties().values()) {
      listReferencedClasses(propType.type).forEach((r) => references.add(r));
    }
    if (references.size === 0) {
      return [];
    }

    const decorators: TypeScriptDecorator[] = [];
    this.addDecoratorToList(
      decorators,
      context,
      'ApiExtraModels',
      NESTJS_SWAGGER_MODULE,
      ['@ApiExtraModels(', [...references].flatMap((r) => [r, ',']), ')'],
      // This will get used by `decoratorsForProperty`, when writing the `references` in the decorators.
      { imports: { '@nestjs/swagger': ['getSchemaPath'] } },
    );
    return decorators;
  }

  decoratorsForProperty(context: ClassPropertyContext): TypeScriptDecorator[] {
    if (!context.objectAttributes[OPENAPI_ATTRIBUTE]) {
      return [];
    }

    const descriptions = this.descriptionForClassProperty(
      context.classType,
      context.jsonName,
    );
    const description = (descriptions ?? []).join('\n').trim();
    const required = !context.property.isOptional;

    const apiPropertySource: SourcelikeArray = ['@ApiProperty({ '];
    if (description) {
      apiPropertySource.push(`description: ${JSON.stringify(description)}, `);
    }
    apiPropertySource.push(
      typeToDecoratorOptions(context.property.type, { required }),
    );
    apiPropertySource.push(' })');

    const decorators: TypeScriptDecorator[] = [];
    this.addDecoratorToList(
      decorators,
      context,
      'ApiProperty',
      NESTJS_SWAGGER_MODULE,
      apiPropertySource,
    );
    return decorators;
  }
}
