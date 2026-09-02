import { Injectable, Inject, Logger } from '@nestjs/common';
import { asc } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import {
  organization,
  glSettings,
  costCenters,
  activities,
} from '@herobm/db-schema';
import { GlService } from './gl.service';

export interface AccountingCodesData {
  header: {
    orgName: string;
    orgAddress?: string;
    orgTaxId?: string;
    orgEmail?: string;
    orgPhone?: string;
    baseCurrency: string;
  };
  coa: Array<{
    accountCode: string;
    name: string;
    accountType: string;
    isGroup: boolean;
    depth: number;
  }>;
  costCenters: Array<{
    code: string;
    name: string;
    isActive: boolean;
  }>;
  activities: Array<{
    code: string;
    name: string;
    isActive: boolean;
  }>;
  customPdfText?: string;
  generatedAt: string;
}

interface CoaTreeNode {
  accountCode: string;
  name: string;
  accountType: string;
  isGroup: boolean;
  children?: CoaTreeNode[];
}

@Injectable()
export class AccountingCodesService {
  private readonly logger = new Logger(AccountingCodesService.name);

  constructor(
    @Inject(DRIZZLE) private readonly db: DrizzleDB,
    private readonly glService: GlService,
  ) {}

  async assembleData(
    _id?: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Boundary auth user
    _user?: any,
    options?: Record<string, unknown>,
  ): Promise<AccountingCodesData> {
    const now = new Date();

    // 1. Fetch organization details
    const orgQuery = await this.db.select().from(organization).limit(1);
    const org = orgQuery.length > 0 ? orgQuery[0] : null;

    // 2. Fetch GL Settings
    const settingsQuery = await this.db.select().from(glSettings).limit(1);
    const settings = settingsQuery.length > 0 ? settingsQuery[0] : null;

    // 3. Fetch Chart of Accounts tree and flatten with depth
    const coaTree =
      (await this.glService.getChartOfAccounts()) as unknown as CoaTreeNode[];
    const coaFlattened: AccountingCodesData['coa'] = [];

    const flattenNodes = (nodes: CoaTreeNode[], depth = 0) => {
      for (const node of nodes) {
        coaFlattened.push({
          accountCode: node.accountCode,
          name: node.name,
          accountType: node.accountType,
          isGroup: Boolean(node.isGroup),
          depth,
        });
        if (node.children && node.children.length > 0) {
          flattenNodes(node.children, depth + 1);
        }
      }
    };
    flattenNodes(coaTree, 0);

    // 4. Fetch Cost Centers
    const ccList = await this.db
      .select({
        code: costCenters.code,
        name: costCenters.name,
        isActive: costCenters.isActive,
      })
      .from(costCenters)
      .orderBy(asc(costCenters.code));

    // 5. Fetch Activities
    const actList = await this.db
      .select({
        code: activities.code,
        name: activities.name,
        isActive: activities.isActive,
      })
      .from(activities)
      .orderBy(asc(activities.code));

    return {
      header: {
        orgName: org?.name || 'HeroBM Operating Entity',
        orgAddress:
          [
            org?.addressLine1,
            org?.city,
            org?.state,
            org?.postCode,
            org?.country,
          ]
            .filter(Boolean)
            .join(', ') || undefined,
        orgTaxId: org?.taxNumber || undefined,
        orgEmail: org?.email || undefined,
        orgPhone: org?.phone || undefined,
        baseCurrency: settings?.baseCurrency || 'AUD',
      },
      coa: coaFlattened,
      costCenters: ccList,
      activities: actList,
      customPdfText: (options?.customPdfText as string) || undefined,
      generatedAt: now.toISOString().slice(0, 19).replace('T', ' '),
    };
  }

  async getRandomId(): Promise<string | undefined> {
    return 'default';
  }

  generateMockData(): AccountingCodesData {
    return {
      header: {
        orgName: 'HeroBM Industrial Pty Ltd',
        orgAddress: '100 Machine Way, Workshop District, NSW 2000, Australia',
        orgTaxId: 'ABN 12 345 678 901',
        orgEmail: 'accounts@herobm.com',
        orgPhone: '+61 2 9000 0000',
        baseCurrency: 'AUD',
      },
      coa: [
        {
          accountCode: '1000',
          name: 'Current Assets',
          accountType: 'asset',
          isGroup: true,
          depth: 0,
        },
        {
          accountCode: '1010',
          name: 'Operating Cash Account',
          accountType: 'asset',
          isGroup: false,
          depth: 1,
        },
        {
          accountCode: '1020',
          name: 'Accounts Receivable Control',
          accountType: 'asset',
          isGroup: false,
          depth: 1,
        },
        {
          accountCode: '2000',
          name: 'Current Liabilities',
          accountType: 'liability',
          isGroup: true,
          depth: 0,
        },
        {
          accountCode: '2010',
          name: 'Accounts Payable Control',
          accountType: 'liability',
          isGroup: false,
          depth: 1,
        },
      ],
      costCenters: [
        { code: '00', name: 'General & Administrative', isActive: true },
        { code: '10', name: 'Manufacturing Operations', isActive: true },
        { code: '20', name: 'Sales & Distribution', isActive: true },
      ],
      activities: [
        { code: '00', name: 'Standard / Unallocated', isActive: true },
        { code: '01', name: 'Direct Customer Delivery', isActive: true },
        { code: '02', name: 'Warranty & Maintenance', isActive: true },
      ],
      generatedAt: '2026-08-27 12:00:00',
    };
  }
}
