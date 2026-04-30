import { GlService } from '../src/gl/gl.service';

export default async function(db: any, schema: any) {
  const service = new GlService(db as any, {} as any);
  const result = await service.getJournalEntries({ limit: 5 });
  return result;
}
