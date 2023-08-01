/**
 * Configuration for TypeScript projects.
 */
export type TypeScriptConfiguration = {
  /**
   * Configuration for JavaScript-related tools, usually for TypeScript projects.
   */
  javascript?: {
    /**
     * Configuration for running npm commands.
     */
    npm?: {
      /**
       * Environment variables to set when running npm.
       * Supports formatting.
       */
      environment?: Record<string, string>;

      /**
       * The version of npm to use.
       * Can be a semver version, or `latest`.
       */
      version?: string;
    };

    /**
     * Configuration related to Node.
     */
    node?: {
      /**
       * The Node version to use, for example when building Docker images.
       * Can be a semver version, or `latest`.
       */
      version?: string;
    };

    /**
     * Configuration related to JavaScript dependencies.
     */
    dependencies?: {
      /**
       * Configuration used when checking dependencies for vulnerabilities.
       */
      check?: {
        /**
         * Whether to ignore vulnerabilities in dev dependencies.
         */
        skipDev?: boolean;

        /**
         * The minimum severity level of vulnerabilities to fail the check.
         */
        level?: 'low' | 'moderate' | 'high' | 'critical';

        /**
         * A list of vulnerabilities to allow.
         * See: https://github.com/IBM/audit-ci#allowlisting
         */
        allowlist?: string[];
      };

      /**
       * Configuration related to the update of dependencies.
       */
      update?: {
        /**
         * The default target version when updating dependencies.
         * Defaults to `latest`.
         */
        defaultTarget?: 'latest' | 'newest' | 'greatest' | 'minor' | 'patch';

        /**
         * The target version for specific packages when updating dependencies.
         * Keys are package names, values are target versions.
         */
        packageTargets?: Record<
          string,
          'latest' | 'newest' | 'greatest' | 'minor' | 'patch'
        >;
      };
    };
  };

  /**
   * Configuration for TypeScript projects.
   */
  typescript?: {
    /**
     * Configuration related to the handling of events in TypeScript code.
     */
    events?: {
      /**
       * The format string used to generate the file path for event schema definition files.
       * The path is relative to the project's root.
       */
      definitionFileFormat?: string;
    };

    /**
     * The path to the Dockerfile used to build service containers for projects in TypeScript.
     */
    serviceContainerDockerfile?: string;
  };
};
