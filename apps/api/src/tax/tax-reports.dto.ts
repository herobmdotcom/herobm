import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsIn } from 'class-validator';

export class TaxReportQueryDto {
  @ApiPropertyOptional({
    description:
      'Start date of the reporting period (inclusive) in YYYY-MM-DD format',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsString()
  fromDate?: string;

  @ApiPropertyOptional({
    description:
      'End date of the reporting period (inclusive) in YYYY-MM-DD format',
    example: '2026-03-31',
  })
  @IsOptional()
  @IsString()
  toDate?: string;

  @ApiPropertyOptional({
    description: 'Report template / jurisdiction type',
    enum: [
      'generic',
      'au_bas',
      'uk_vat',
      'sg_gst',
      'nz_gst',
      'de_ustva',
      'us_sales_tax',
    ],
    default: 'generic',
  })
  @IsOptional()
  @IsString()
  @IsIn([
    'generic',
    'au_bas',
    'uk_vat',
    'sg_gst',
    'nz_gst',
    'de_ustva',
    'us_sales_tax',
  ])
  reportType?: string;
}

export class TaxCategoryBreakdownDto {
  @ApiProperty({ description: 'Tax category ID' })
  taxCategoryId: string;

  @ApiProperty({ description: 'Tax category code', example: 'GST_10' })
  code: string;

  @ApiProperty({
    description: 'Tax category title',
    example: 'Standard GST 10%',
  })
  title: string;

  @ApiProperty({
    description: 'Tax classification type',
    example: 'tax_applies',
  })
  type: string;

  @ApiProperty({ description: 'Tax percentage rate', example: 10 })
  rate: number;

  @ApiProperty({ description: 'Net sales base turnover for this tax category' })
  salesBase: number;

  @ApiProperty({ description: 'Total output tax collected on sales' })
  outputTax: number;

  @ApiProperty({
    description: 'Net purchase base turnover for this tax category',
  })
  purchaseBase: number;

  @ApiProperty({ description: 'Total input tax claimed on purchases' })
  inputTax: number;

  @ApiProperty({ description: 'Net tax position (Output Tax - Input Tax)' })
  netTax: number;
}

export class TaxReportBoxDto {
  @ApiProperty({
    description: 'Statutory box / line identifier',
    example: '1A',
  })
  id: string;

  @ApiProperty({ description: 'Official box code or label', example: '1A' })
  code: string;

  @ApiProperty({
    description: 'Box description / line name',
    example: 'GST on sales',
  })
  description: string;

  @ApiProperty({ description: 'Numeric rounded amount', example: 1250 })
  amount: number;

  @ApiPropertyOptional({
    description: 'Grouping or category of the box',
    example: 'GST',
  })
  section?: string;
}

export class GenericTaxSummaryDto {
  @ApiProperty({
    description: 'Total output tax collected on sales (Tax Payable)',
  })
  totalOutputTax: number;

  @ApiProperty({
    description:
      'Total input tax paid on purchases (Tax Deductible / Reclaimable)',
  })
  totalInputTax: number;

  @ApiProperty({
    description: 'Net tax liability or refund claim (Output Tax - Input Tax)',
  })
  netTaxLiability: number;

  @ApiProperty({
    description:
      'Indicates whether the net amount is payable, refundable, or zero',
    type: String,
    enum: ['payable', 'refundable', 'zero'],
    example: 'payable',
  })
  netStatus: 'payable' | 'refundable' | 'zero';

  @ApiProperty({ description: 'Total gross sales turnover (inclusive of tax)' })
  totalGrossSales: number;

  @ApiProperty({ description: 'Total net revenue / sales (exclusive of tax)' })
  totalNetSales: number;

  @ApiProperty({ description: 'Net taxable sales turnover' })
  taxableSales: number;

  @ApiProperty({ description: 'Net zero-rated or exempt sales turnover' })
  exemptSales: number;

  @ApiProperty({ description: 'Total net purchases / expense base' })
  totalNetPurchases: number;

  @ApiProperty({ description: 'Net taxable purchases' })
  taxablePurchases: number;

  @ApiProperty({ description: 'Base currency code', example: 'AUD' })
  currencyCode: string;

  @ApiProperty({
    description: 'Breakdown of turnover and taxes by configured tax category',
    type: [TaxCategoryBreakdownDto],
  })
  categories: TaxCategoryBreakdownDto[];
}

export class TaxReportResponseDto {
  @ApiProperty({ description: 'Report type requested', example: 'generic' })
  reportType: string;

  @ApiProperty({
    description: 'Human-readable title of the report',
    example: 'Generic Tax Summary',
  })
  title: string;

  @ApiProperty({
    description: 'Subtitle or jurisdiction description',
    example: 'International Tax Balances & VAT/GST Summary',
  })
  subtitle: string;

  @ApiProperty({
    description: 'Generic tax summary metrics and category schedule',
    type: GenericTaxSummaryDto,
  })
  genericSummary: GenericTaxSummaryDto;

  @ApiPropertyOptional({
    description:
      'Statutory box lines (when country-specific report is selected)',
    type: [TaxReportBoxDto],
  })
  boxes?: TaxReportBoxDto[];
}
