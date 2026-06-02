import { ApiProperty } from '@nestjs/swagger';

export class MatchedJournalLineDto {
  @ApiProperty()
  debit: number;

  @ApiProperty()
  credit: number;

  @ApiProperty({ required: false, nullable: true })
  memo?: string;

  @ApiProperty({ type: String, format: 'date' })
  entryDate: Date;

  @ApiProperty()
  isReconciled: boolean;
}

export class BankStatementLineDto {
  @ApiProperty()
  lineId: string;

  @ApiProperty({ type: String, format: 'date-time' })
  date: Date;

  @ApiProperty()
  description: string;

  @ApiProperty()
  amount: number;

  @ApiProperty({ required: false, nullable: true })
  reference?: string;

  @ApiProperty()
  isReconciled: boolean;

  @ApiProperty({ required: false, nullable: true })
  matchedJournalLineId?: string;

  @ApiProperty({ type: MatchedJournalLineDto, required: false, nullable: true })
  matchedJournalLine?: MatchedJournalLineDto;
}

export class BankStatementLinesResponseDto {
  @ApiProperty({ type: [BankStatementLineDto] })
  data: BankStatementLineDto[];
}

export class BankStatementConfirmMatchDto {
  @ApiProperty({
    required: false,
    description:
      'Optional reconciliation ID to link the matched ledger line to',
  })
  reconciliationId?: string;
}

export class BankStatementManualMatchDto {
  @ApiProperty({ description: 'The journal line ID to link against' })
  journalLineId!: string;

  @ApiProperty({
    required: false,
    description:
      'Optional reconciliation ID to link the matched ledger line to',
  })
  reconciliationId?: string;
}
