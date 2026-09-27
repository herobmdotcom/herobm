import { Decimal } from 'decimal.js';
import { BadRequestException, Logger } from '@nestjs/common';
import { AppConfigService } from '../settings/app-config.service';
import { OrganizationService } from '../settings/organization.service';
import { EnrichmentService } from '../enrichment/enrichment.service';
import { getErrorMessage } from '@herobm/shared';

export interface RecordExternalTaxParams {
  appConfig: AppConfigService;
  organizationService: OrganizationService;
  enrichmentService: EnrichmentService;
  logger: Logger;
  invoiceId: string;
  invoiceNumber: string;
  totalAmount: number;
  taxAmount: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Outbox line details
  outboxLineDetails: any[];
  billingAddressCountry: string | null;
  billingAddressPostalCode: string | null;
  billingAddressStateOrProvince: string | null;
  billingAddressCity: string | null;
  billingAddressLine1: string | null;
}

export async function recordExternalSalesInvoiceTaxTransaction(
  params: RecordExternalTaxParams,
): Promise<void> {
  const {
    appConfig,
    organizationService,
    enrichmentService,
    logger,
    invoiceId,
    invoiceNumber,
    totalAmount,
    taxAmount,
    outboxLineDetails,
    billingAddressCountry,
    billingAddressPostalCode,
    billingAddressStateOrProvince,
    billingAddressCity,
    billingAddressLine1,
  } = params;

  const mappings = appConfig.taxProviderMappings();
  const orderTaxProvider =
    mappings[billingAddressCountry || 'US'] || 'internal';

  if (
    orderTaxProvider &&
    orderTaxProvider !== 'internal' &&
    !orderTaxProvider.endsWith('-error')
  ) {
    const org = await organizationService.get();

    const freightLines = outboxLineDetails.filter(
      (l) => l.productType === 'freight',
    );
    const taxableLines = outboxLineDetails.filter(
      (l) => l.productType !== 'freight',
    );

    const shippingTotal = freightLines
      .reduce((sum, l) => {
        const discountAmt = new Decimal(l.pricePerUnit)
          .mul(new Decimal(l.discountPercentage || 0).div(100))
          .mul(l.quantity);
        const lineAmt = new Decimal(l.quantity)
          .mul(l.pricePerUnit)
          .minus(discountAmt);
        return sum.add(lineAmt);
      }, new Decimal(0))
      .toNumber();

    const payload = {
      transaction_id: invoiceId,
      transaction_date: new Date().toISOString(),
      amount: totalAmount,
      shipping: shippingTotal,
      sales_tax: taxAmount,
      from_country: org.country || 'US',
      from_zip: org.postCode,
      from_state: org.state,
      from_city: org.city,
      from_street: org.addressLine1,
      to_country: billingAddressCountry || undefined,
      to_zip: billingAddressPostalCode || undefined,
      to_state: billingAddressStateOrProvince || undefined,
      to_city: billingAddressCity || undefined,
      to_street: billingAddressLine1 || undefined,
      line_items: taxableLines.map((l) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- External API integration boundaries
        const payloadLine: any = {
          id: l.salesOrderLineId,
          product_identifier: l.productNumber,
          description: l.productDescription,
          quantity: l.quantity,
          unit_price: l.pricePerUnit,
          discount: new Decimal(l.pricePerUnit)
            .mul(new Decimal(l.discountPercentage || 0).div(100))
            .mul(l.quantity)
            .toNumber(),
          sales_tax: l.tax,
        };
        if (l.externalTaxCode) {
          payloadLine.product_tax_code = l.externalTaxCode;
        }
        return payloadLine;
      }),
    };

    try {
      const enrichRes = await enrichmentService.recordTransaction(
        orderTaxProvider,
        payload,
      );
      if (!enrichRes.isValid) {
        throw new BadRequestException(
          `Tax provider rejected transaction: ${String(enrichRes.data?.error)}`,
        );
      }
      logger.log(
        `Transaction recorded in ${orderTaxProvider} for invoice ${invoiceNumber}`,
      );
    } catch (e: unknown) {
      logger.error(`Failed to record transaction in ${orderTaxProvider}`, e);
      throw new BadRequestException(
        `Failed to record transaction in ${orderTaxProvider}: ${getErrorMessage(e)}`,
      );
    }
  }
}
