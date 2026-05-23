import { Injectable, BadRequestException } from '@nestjs/common';

export interface AbaTransaction {
  bsb: string;
  accountNumber: string;
  accountName: string;
  amount: number;
  traceBsb: string;
  traceAccountNumber: string;
  remitterName: string;
  reference: string;
  transactionCode?: string;
}

export interface AbaFileContext {
  bankName: string; // e.g. "CBA" or "BQL"
  abaUserName: string;
  abaUserId: string; // APCA number
  description: string;
  processDate: string; // DDMMYY
  transactions: AbaTransaction[];
}

@Injectable()
export class AbaGeneratorService {
  /**
   * Generates an ABA file string according to the Cemtex specification.
   * @param context Context containing bank details and transactions
   */
  generateAbaFile(context: AbaFileContext): string {
    const lines: string[] = [];

    // Type 0 - Descriptive Record
    lines.push(this.formatDescriptiveRecord(context));

    let netTotal = 0;
    let creditTotal = 0;
    const debitTotal = 0;

    // Type 1 - Detail Records
    for (const tx of context.transactions) {
      if (tx.amount <= 0) {
        throw new BadRequestException(
          'Transaction amount must be greater than zero.',
        );
      }
      lines.push(this.formatDetailRecord(tx));
      creditTotal += tx.amount;
      netTotal += tx.amount;
    }

    // Type 7 - File Total Record
    lines.push(
      this.formatFileTotalRecord(
        context,
        netTotal,
        creditTotal,
        debitTotal,
        context.transactions.length,
      ),
    );

    return lines.join('\r\n');
  }

  private formatDescriptiveRecord(context: AbaFileContext): string {
    let line = '0'; // Record Type
    line += this.padStr('', 17); // Blank
    line += '01'; // Reel Sequence Number
    line += this.padStr(context.bankName, 3); // Name of User's Bank
    line += this.padStr('', 7); // Blank
    line += this.padStr(context.abaUserName, 26); // Name of User
    line += this.padStr(context.abaUserId, 6, '0'); // Direct Entry User ID
    line += this.padStr(context.description, 12); // Description of Entries
    line += this.padStr(context.processDate, 6); // Date to be processed (DDMMYY)
    line += this.padStr('', 40); // Blank

    if (line.length !== 120) {
      throw new BadRequestException(
        `Descriptive record length is ${line.length}, expected 120`,
      );
    }
    return line;
  }

  private formatDetailRecord(tx: AbaTransaction): string {
    let line = '1'; // Record Type
    line += this.formatBsb(tx.bsb); // BSB Number (XXX-XXX)
    line += this.padStr(tx.accountNumber, 9); // Account Number
    line += ' '; // Indicator (blank)
    line += tx.transactionCode || '53'; // Transaction Code (53 = Pay/Credit)

    const amountCents = Math.round(tx.amount * 100).toString();
    line += this.padStr(amountCents, 10, '0', true); // Amount

    line += this.padStr(tx.accountName, 32); // Title of Account
    line += this.padStr(tx.reference, 18); // Lodgement Reference
    line += this.formatBsb(tx.traceBsb); // Trace BSB
    line += this.padStr(tx.traceAccountNumber, 9); // Trace Account Number
    line += this.padStr(tx.remitterName, 16); // Name of Remitter
    line += '00000000'; // Withholding tax amount

    if (line.length !== 120) {
      throw new BadRequestException(
        `Detail record length is ${line.length}, expected 120`,
      );
    }
    return line;
  }

  private formatFileTotalRecord(
    context: AbaFileContext,
    netTotal: number,
    creditTotal: number,
    debitTotal: number,
    recordCount: number,
  ): string {
    let line = '7'; // Record Type
    line += '999-999'; // BSB Format filler
    line += this.padStr('', 12); // Blank

    const netTotalCents = Math.round(Math.abs(netTotal) * 100).toString();
    const creditTotalCents = Math.round(creditTotal * 100).toString();
    const debitTotalCents = Math.round(debitTotal * 100).toString();

    line += this.padStr(netTotalCents, 10, '0', true); // Net Total
    line += this.padStr(creditTotalCents, 10, '0', true); // Credit Total
    line += this.padStr(debitTotalCents, 10, '0', true); // Debit Total
    line += this.padStr('', 24); // Blank
    line += this.padStr(recordCount.toString(), 6, '0', true); // Record count
    line += this.padStr('', 40); // Blank

    if (line.length !== 120) {
      throw new BadRequestException(
        `File total record length is ${line.length}, expected 120`,
      );
    }
    return line;
  }

  private padStr(
    val: string,
    length: number,
    padChar = ' ',
    padLeft = false,
  ): string {
    // Sanitize to ASCII
    // eslint-disable-next-line no-control-regex
    let sanitized = val.replace(/[^\x00-\x7F]/g, '').toUpperCase();
    if (sanitized.length > length) {
      sanitized = sanitized.substring(0, length);
    }
    if (padLeft) {
      return sanitized.padStart(length, padChar);
    }
    return sanitized.padEnd(length, padChar);
  }

  private formatBsb(bsb: string): string {
    const clean = bsb.replace(/[^0-9]/g, '');
    if (clean.length !== 6) {
      throw new BadRequestException(`Invalid BSB: ${bsb}`);
    }
    return `${clean.substring(0, 3)}-${clean.substring(3, 6)}`;
  }
}
