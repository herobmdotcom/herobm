import { Injectable, BadRequestException } from '@nestjs/common';
import {
  Nacha,
  Batch,
  Entry,
  ServiceClass,
  TransactionCode,
  batchCodeFromString,
} from 'nacha-cheese';

export interface NachaTransaction {
  routingNumber: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  reference: string;
  transactionCode?: number;
}

export interface NachaFileContext {
  companyName: string;
  companyId: string;
  immediateDestination: string;
  immediateDestinationName: string;
  referenceCode?: string;
  description: string;
  processDate: Date;
  transactions: NachaTransaction[];
}

@Injectable()
export class NachaGeneratorService {
  /**
   * Generates a NACHA file string according to the ACH specification.
   * @param context Context containing bank details and transactions
   */
  generateNachaFile(context: NachaFileContext): string {
    const file = new Nacha({
      destinationRoutingNumber: context.immediateDestination,
      originIdentifier: context.companyId,
      destinationName: context.immediateDestinationName,
      originName: context.companyName,
      referenceCode: context.referenceCode || 'PAYMENTS',
    });

    const batch = new Batch({
      transactionTypes: ServiceClass.CreditDebit,
      originCompanyName: context.companyName,
      originIdentification: context.companyId,
      code: batchCodeFromString('PPD') as any, // Prearranged Payment and Deposit
      description: context.description,
      effectiveEntryDate: context.processDate,
      originDfi: context.immediateDestination.slice(0, 8),
    });

    for (const tx of context.transactions) {
      if (tx.amount <= 0) {
        throw new BadRequestException(
          'Transaction amount must be greater than zero.',
        );
      }

      const routingClean = tx.routingNumber.replace(/[^0-9]/g, '');
      if (routingClean.length !== 9) {
        throw new BadRequestException(
          `Invalid US Routing Number (must be 9 digits): ${tx.routingNumber}`,
        );
      }

      batch.addEntry(
        new Entry({
          transactionCode: tx.transactionCode || TransactionCode.CheckingCredit,
          destinationRoutingNumber: routingClean,
          destinationAccountNumber: tx.accountNumber,
          amount: Math.round(tx.amount * 100), // cents
          transactionId: tx.reference,
          destinationName: tx.accountName,
        }),
      );
    }

    file.addBatch(batch);
    return file.toOutput();
  }
}
