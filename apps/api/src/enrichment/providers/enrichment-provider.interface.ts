export interface EnrichmentResult {
  isValid: boolean;
  data: Record<string, any>;
}

export interface IEnrichmentProvider {
  /**
   * The unique identifier for this provider (e.g. 'abr')
   */
  get name(): string;

  /**
   * Perform a lookup against the external service.
   * @param payload The input string (e.g. business number) or JSON object
   * @param config The provider configuration (e.g. API keys)
   * @returns EnrichmentResult
   */
  lookup(
    payload: string | Record<string, any>,
    config?: Record<string, any>,
  ): Promise<EnrichmentResult>;

  /**
   * Return the JSON schema defining the required configuration for this provider.
   */
  getConfigSchema(): any;
}
