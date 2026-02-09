/**
 * Configuration for TypeScript projects.
 */
export type TypeScriptConfiguration = {
  /**
   * Configuration for JavaScript-related tools, usually for TypeScript projects.
   */
  readonly javascript?: {
    /**
     * Configuration for running npm commands.
     */
    readonly npm?: {
      /**
       * Environment variables to set when running npm.
       * Supports formatting.
       */
      readonly environment?: Record<string, string>;

      /**
       * The version of npm to use.
       * Can be a semver version, or `latest`.
       */
      readonly version?: string;

      /**
       * The destination directory for built packages, relative to the project's root.
       * This is used when building JavaScript / TypeScript package artefacts.
       */
      readonly packDestination?: string;
    };

    /**
     * Configuration related to Node.
     */
    readonly node?: {
      /**
       * The Node version to use, for example when building Docker images.
       * Can be a semver version, or `latest`.
       */
      readonly version?: string;
    };

    /**
     * Configuration related to JavaScript dependencies.
     */
    readonly dependencies?: {
      /**
       * Configuration used when checking dependencies for vulnerabilities.
       */
      readonly check?: {
        /**
         * Whether to ignore vulnerabilities in dev dependencies.
         */
        readonly skipDev?: boolean;

        /**
         * The minimum severity level of vulnerabilities to fail the check.
         */
        readonly level?: 'low' | 'moderate' | 'high' | 'critical';

        /**
         * A list of vulnerabilities to allow.
         * See: https://github.com/IBM/audit-ci#allowlisting
         */
        readonly allowlist?: string[];
      };

      /**
       * Configuration related to the update of dependencies.
       */
      readonly update?: {
        /**
         * The default target version when updating dependencies.
         * Defaults to `latest`.
         */
        readonly defaultTarget?:
          | 'latest'
          | 'newest'
          | 'greatest'
          | 'minor'
          | 'patch';

        /**
         * The target version for specific packages when updating dependencies.
         * Keys are package names, values are target versions.
         */
        readonly packageTargets?: Record<
          string,
          'latest' | 'newest' | 'greatest' | 'minor' | 'patch'
        >;
      };
    };

    /**
     * Configuration related to the generation of OpenAPI specifications.
     */
    readonly openApi?: {
      /**
       * Defines the location of the NestJS application module when generating the OpenAPI specification for a
       * `serviceContainer` project.
       * If this is not set or `null`, the OpenAPI specification will not be generated.
       */
      readonly applicationModule?: {
        /**
         * The JavaScript source file containing the NestJS application module.
         * This path is relative to the Docker container's `/app` directory (the working directory), which is usually
         * also the project's root.
         */
        readonly sourceFile: string;

        /**
         * The name of the JavaScript class for NestJS application module.
         * It should be exported from the source file.
         */
        readonly name: string;
      } | null;
    };
  };

  /**
   * Configuration for TypeScript projects.
   */
  readonly typescript?: {
    /**
     * Configuration related to the generation of TypeScript code, e.g. models.
     */
    readonly codeGeneration?: {
      /**
       * The path, relative to the project root, to the file where generated event definitions should be written.
       * Defaults to `src/model.ts`.
       */
      readonly outputFile?: string;

      /**
       * Whether to add non-null assertions (`!`) on properties of model classes.
       * Defaults to `true`.
       */
      readonly nonNullAssertionOnProperties?: boolean;

      /**
       * Whether to add the `readonly` keyword to properties of model classes.
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
       * The list of decorator renderers to apply during code generation.
       * By default, all renderers are used.
       */
      readonly decoratorRenderers?: string[];

      /**
       * Options used to configure decorator renderers.
       */
      readonly decoratorOptions?: Record<string, any>;
    };
  };
};
