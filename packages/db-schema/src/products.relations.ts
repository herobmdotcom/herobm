import { relations } from 'drizzle-orm';
import { products } from './products.schema';
import { projectResources } from './projects.schema';

export const productsRelations = relations(products, ({ many }) => ({
  projectResources: many(projectResources),
}));
