import { Adapter, Model, Helper } from 'casbin';
import { eq, and, sql } from 'drizzle-orm';
import type { DrizzleDB } from '../../drizzle/drizzle.module';
import { casbinRule } from '../../drizzle/modbm-core-schema';

export class DrizzleAdapter implements Adapter {
  private db: DrizzleDB;

  constructor(db: DrizzleDB) {
    this.db = db;
  }

  public async loadPolicy(model: Model): Promise<void> {
    const lines = await this.db.select().from(casbinRule);
    for (const line of lines) {
      this.loadPolicyLine(line, model);
    }
  }

  private loadPolicyLine(
    line: Record<string, string | null>,
    model: Model,
  ): void {
    const lineText = [
      line.ptype,
      line.v0,
      line.v1,
      line.v2,
      line.v3,
      line.v4,
      line.v5,
    ]
      .filter((n) => n)
      .join(', ');
    Helper.loadPolicyLine(lineText, model);
  }

  // @modbm-skip-audit
  public async savePolicy(model: Model): Promise<boolean> {
    // Drop all policies
    await this.db.delete(casbinRule);

    const astMap = model.model.get('p');
    if (astMap) {
      for (const [ptype, ast] of astMap) {
        for (const rule of ast.policy) {
          await this.savePolicyLine(ptype, rule);
        }
      }
    }

    const astMapG = model.model.get('g');
    if (astMapG) {
      for (const [ptype, ast] of astMapG) {
        for (const rule of ast.policy) {
          await this.savePolicyLine(ptype, rule);
        }
      }
    }

    return true;
  }

  // @modbm-skip-audit
  private async savePolicyLine(ptype: string, rule: string[]): Promise<void> {
    const line = this.getPolicyLine(ptype, rule);
    await this.db.insert(casbinRule).values(line);
  }

  private getPolicyLine(
    ptype: string,
    rule: string[],
  ): typeof casbinRule.$inferInsert {
    return {
      ptype,
      v0: rule[0] || null,
      v1: rule[1] || null,
      v2: rule[2] || null,
      v3: rule[3] || null,
      v4: rule[4] || null,
      v5: rule[5] || null,
    };
  }

  public async addPolicy(
    sec: string,
    ptype: string,
    rule: string[],
  ): Promise<void> {
    await this.savePolicyLine(ptype, rule);
  }

  // @modbm-skip-audit
  public async removePolicy(
    sec: string,
    ptype: string,
    rule: string[],
  ): Promise<void> {
    let query = this.db.delete(casbinRule).where(eq(casbinRule.ptype, ptype));

    if (rule.length > 0) {
      query = this.db
        .delete(casbinRule)
        .where(and(eq(casbinRule.ptype, ptype), eq(casbinRule.v0, rule[0])));
      // Constructing dynamic ANDs for a delete statement can be tricky in some older versions of drizzle,
      // so let's do a more explicit construction:
      const conditions = [eq(casbinRule.ptype, ptype)];
      if (rule[0] !== undefined) conditions.push(eq(casbinRule.v0, rule[0]));
      if (rule[1] !== undefined) conditions.push(eq(casbinRule.v1, rule[1]));
      if (rule[2] !== undefined) conditions.push(eq(casbinRule.v2, rule[2]));
      if (rule[3] !== undefined) conditions.push(eq(casbinRule.v3, rule[3]));
      if (rule[4] !== undefined) conditions.push(eq(casbinRule.v4, rule[4]));
      if (rule[5] !== undefined) conditions.push(eq(casbinRule.v5, rule[5]));

      await this.db.delete(casbinRule).where(and(...conditions));
      return;
    }

    await query;
  }

  // @modbm-skip-audit
  public async removeFilteredPolicy(
    sec: string,
    ptype: string,
    fieldIndex: number,
    ...fieldValues: string[]
  ): Promise<void> {
    const conditions = [eq(casbinRule.ptype, ptype)];

    if (fieldIndex <= 0 && 0 < fieldIndex + fieldValues.length) {
      conditions.push(eq(casbinRule.v0, fieldValues[0 - fieldIndex]));
    }
    if (fieldIndex <= 1 && 1 < fieldIndex + fieldValues.length) {
      conditions.push(eq(casbinRule.v1, fieldValues[1 - fieldIndex]));
    }
    if (fieldIndex <= 2 && 2 < fieldIndex + fieldValues.length) {
      conditions.push(eq(casbinRule.v2, fieldValues[2 - fieldIndex]));
    }
    if (fieldIndex <= 3 && 3 < fieldIndex + fieldValues.length) {
      conditions.push(eq(casbinRule.v3, fieldValues[3 - fieldIndex]));
    }
    if (fieldIndex <= 4 && 4 < fieldIndex + fieldValues.length) {
      conditions.push(eq(casbinRule.v4, fieldValues[4 - fieldIndex]));
    }
    if (fieldIndex <= 5 && 5 < fieldIndex + fieldValues.length) {
      conditions.push(eq(casbinRule.v5, fieldValues[5 - fieldIndex]));
    }

    await this.db.delete(casbinRule).where(and(...conditions));
  }
}
