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
   * The type of provider (e.g., 'enrichment', 'tax_engine')
   */
  get type(): 'enrichment' | 'tax_engine';

  /**
   * List of ISO Alpha-2 country codes this provider supports, or 'global' for all.
   */
  get supportedCountries(): string[] | 'global';

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

  /**
   * Optional: Record a formal transaction to the provider (for stateful API engines like tax providers)
   */
  recordTransaction?(
    payload: Record<string, any>,
    config?: Record<string, any>,
  ): Promise<EnrichmentResult>;

  /**
   * Optional: Reverse a previously recorded formal transaction
   */
  recordRefund?(
    payload: Record<string, any>,
    config?: Record<string, any>,
  ): Promise<EnrichmentResult>;
}
