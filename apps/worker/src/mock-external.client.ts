export class MockExternalClient {
  private readonly baseUrl = 'mock://external-system';

  async authenticate(): Promise<void> {
    console.log(`[MockExternalClient] Authenticated to ${this.baseUrl}`);
  }

  async syncInvoice(payload: any): Promise<any> {
    console.log(`[MockExternalClient] Syncing Invoice:`, payload);
    // Simulate some delay
    await new Promise((resolve) => setTimeout(resolve, 100));
    return {
      success: true,
      externalId: `EXT-INV-${Date.now()}`,
    };
  }

  async syncJournalEntry(payload: any): Promise<any> {
    console.log(`[MockExternalClient] Syncing Journal Entry:`, payload);
    await new Promise((resolve) => setTimeout(resolve, 100));
    return {
      success: true,
      externalId: `EXT-JV-${Date.now()}`,
    };
  }
}
