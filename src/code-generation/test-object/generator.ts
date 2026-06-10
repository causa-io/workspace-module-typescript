import type {
  ArrayPropertyType,
  ConstPropertyType,
  GeneratedSchemas,
  ObjectSchema,
  Property,
  RefPropertyType,
  Schema,
} from '@causa/workspace-core';
import {
  BaseTypeScriptCodeGenerator,
  collectRefs,
  findEnumCaseName,
  findModelClass,
  getConstraintBaseObject,
  getConstraintBasePath,
  propertyKey,
  topologicalSort,
} from '../base.js';

/**
 * Generates TypeScript `make*` factory functions for the given {@link Schema}s and writes the formatted output to
 * disk.
 *
 * Each object schema becomes a `make<ClassName>(data?: Partial<ClassName>): ClassName` function that constructs a
 * default instance suitable for tests. Enums and unions are not emitted (only their referenced types' make functions
 * use them). Constraint schemas (with `extensions.constraintFor`) instantiate the base class and cast to the
 * constraint type.
 */
export class TypeScriptTestObjectGenerator extends BaseTypeScriptCodeGenerator {
  /**
   * Creates a new generator.
   *
   * @param outputPath Absolute path of the file the rendered source will be written to.
   * @param schemas The schemas to render, indexed by their absolute source path. Should include every schema that the
   *   emitted functions can reach (objects to emit + every enum / object referenced from their properties), since the
   *   default-value emitter introspects them.
   * @param modelClassSchemas The output of the model-class generator, used to look up the class / enum name and the
   *   file each model-class symbol lives in.
   */
  constructor(
    outputPath: string,
    readonly schemas: Record<string, Schema>,
    readonly modelClassSchemas: GeneratedSchemas,
  ) {
    super(outputPath);
  }

  /**
   * Renders all eligible schemas, formats the output with prettier, and writes it to {@link outputPath}.
   * Populates {@link generatedSchemas}.
   */
  async generate(): Promise<void> {
    const blocks = this.topologicalSort().map((s) => this.emitMakeFunction(s));
    await this.renderFile(blocks.join('\n\n'));
  }

  /**
   * Returns the object schemas this generator should emit `make*` functions for, topologically sorted so that
   * dependencies (nested objects) come first.
   */
  private topologicalSort(): ObjectSchema[] {
    const objectPaths = Object.entries(this.schemas)
      .filter(([, s]) => s.kind === 'object')
      .map(([p]) => p);

    const sorted = topologicalSort(
      objectPaths,
      (p) => {
        const deps = new Set<string>();
        for (const property of (this.schemas[p] as ObjectSchema).properties) {
          collectRefs(
            property.type,
            deps,
            (ref) => this.schemas[ref]?.kind === 'object',
          );
        }
        return deps;
      },
      (p) => this.modelClassSchemas[p]?.name ?? p,
    );
    return sorted.map((p) => this.schemas[p] as ObjectSchema);
  }

  /**
   * Emits the `make<Name>` function for a single object schema and records it in {@link generatedSchemas}.
   */
  private emitMakeFunction(schema: ObjectSchema): string {
    const constraintForPath = getConstraintBasePath(schema);
    const isConstraint = constraintForPath !== undefined;
    const modelClass = findModelClass(this.modelClassSchemas, schema.path);
    const functionName = `make${modelClass.name}`;

    let instantiationClassName: string;
    if (constraintForPath !== undefined) {
      const base = findModelClass(this.modelClassSchemas, constraintForPath);
      instantiationClassName = base.name;
      this.addImports({ [base.file]: [base.name] });
      this.addImports({ [modelClass.file]: [`type ${modelClass.name}`] });
    } else {
      instantiationClassName = modelClass.name;
      this.addImports({ [modelClass.file]: [modelClass.name] });
    }

    this.generatedSchemas[schema.path] = {
      name: functionName,
      file: this.outputPath,
    };

    return `export function ${functionName}(data: Partial<${modelClass.name}> = {}): ${modelClass.name} {
  return new ${instantiationClassName}({
    ${this.emitPropertyDefaults(schema)}
    ...data,
  })${isConstraint ? ` as ${modelClass.name}` : ''};
}`;
  }

  /**
   * Emits the property defaults for the given object schema. For a constraint schema, the constraint's own properties
   * are emitted first (alphabetically), followed by the base schema's remaining properties (also alphabetically).
   */
  private emitPropertyDefaults(schema: ObjectSchema): string {
    const baseObject = getConstraintBaseObject(schema, this.schemas);

    const ownEntries = schema.properties
      .map((p) => [p.name, this.defaultValueForProperty(p, baseObject)])
      .sort(([a], [b]) => a.localeCompare(b));

    const ownNames = new Set(schema.properties.map((p) => p.name));
    const baseExtras = (baseObject?.properties ?? [])
      .filter((p) => !ownNames.has(p.name))
      .map((p) => [p.name, this.defaultValueForProperty(p)])
      .sort(([a], [b]) => a.localeCompare(b));

    return [...ownEntries, ...baseExtras]
      .map(([name, source]) => `${propertyKey(name)}: ${source},`)
      .join('\n');
  }

  /**
   * Returns the TypeScript source for the default value of a property, applying the `testObjectDefaultValue` and
   * `enumHint` extensions where relevant.
   */
  private defaultValueForProperty(
    property: Property,
    baseSchema?: ObjectSchema,
  ): string {
    const serialized =
      property.extensions.testObjectDefaultValue !== undefined
        ? JSON.stringify(property.extensions.testObjectDefaultValue)
        : undefined;

    if (property.nullable && serialized === undefined) {
      return 'null';
    }

    const type = property.type;
    const kind = type.kind !== 'primitive' ? type.kind : type.type;
    switch (kind) {
      case 'null': {
        return 'null';
      }
      case 'const': {
        const constValue = (type as ConstPropertyType).value;
        const baseProperty = baseSchema?.properties.find(
          (p) => p.name === property.name,
        );
        if (baseProperty?.type.kind === 'ref') {
          const baseEnum = this.schemas[baseProperty.type.ref];
          if (baseEnum?.kind === 'enum') {
            const caseName = findEnumCaseName(baseEnum, constValue);
            if (caseName) {
              const modelClass = findModelClass(
                this.modelClassSchemas,
                baseEnum.path,
              );
              this.addImports({ [modelClass.file]: [modelClass.name] });
              return `${modelClass.name}.${caseName}`;
            }
          }
        }
        return JSON.stringify(constValue);
      }
      case 'array': {
        const arrayType = type as ArrayPropertyType;
        const itemRef =
          arrayType.items.kind === 'ref' ? arrayType.items.ref : undefined;
        const itemSchema = itemRef ? this.schemas[itemRef] : undefined;
        const defaultValues = property.extensions.testObjectDefaultValue;
        if (
          itemSchema?.kind === 'enum' &&
          Array.isArray(defaultValues) &&
          defaultValues.length > 0
        ) {
          const modelClass = findModelClass(
            this.modelClassSchemas,
            itemSchema.path,
          );
          this.addImports({ [modelClass.file]: [modelClass.name] });
          const entries = defaultValues.map((value) => {
            const caseName = findEnumCaseName(itemSchema, value);
            if (!caseName) {
              throw new Error(
                `Unknown enum value '${String(value)}' for property '${property.name}'.`,
              );
            }
            return `${modelClass.name}.${caseName}`;
          });
          return `[${entries.join(', ')}]`;
        }
        return serialized ?? '[]';
      }
      case 'map': {
        return serialized ?? '{}';
      }
      case 'ref': {
        const target = this.schemas[(type as RefPropertyType).ref];
        if (target?.kind === 'enum') {
          const value =
            property.extensions.testObjectDefaultValue ?? target.values[0];
          if (value === undefined) {
            throw new Error(
              `Enum '${target.name}' referenced from property '${property.name}' has no values.`,
            );
          }
          const caseName = findEnumCaseName(target, value);
          if (!caseName) {
            throw new Error(
              `Unknown enum value '${String(value)}' for property '${property.name}'.`,
            );
          }
          const modelClass = findModelClass(
            this.modelClassSchemas,
            target.path,
          );
          this.addImports({ [modelClass.file]: [modelClass.name] });
          return `${modelClass.name}.${caseName}`;
        }
        if (target?.kind === 'object') {
          return `make${findModelClass(this.modelClassSchemas, target.path).name}(${serialized ?? ''})`;
        }
        if (target?.kind === 'union') {
          const firstType = target.types[0];
          if (firstType === undefined) {
            throw new Error(
              `Union '${target.name}' referenced from property '${property.name}' has no member types.`,
            );
          }
          return this.defaultValueForProperty(
            { ...property, type: firstType, nullable: false },
            baseSchema,
          );
        }
        return serialized ?? "'unknown'";
      }
      case 'string': {
        if (serialized !== undefined) {
          return serialized;
        }
        const enumHint = property.extensions.enumHint;
        if (typeof enumHint === 'string') {
          const target = this.schemas[enumHint];
          if (target?.kind === 'enum' && target.values.length > 0) {
            return JSON.stringify(target.values[0]);
          }
        }
        return "'string'";
      }
      case 'integer': {
        return serialized ?? '0';
      }
      case 'number': {
        return serialized ?? '0.0';
      }
      case 'boolean': {
        return serialized ?? 'false';
      }
      case 'datetime': {
        return `new Date(${serialized ?? ''})`;
      }
      case 'uuid': {
        if (serialized !== undefined) {
          return serialized;
        }
        const randomUUID = this.importExternal('crypto', 'randomUUID');
        return `${randomUUID}()`;
      }
    }
  }
}
