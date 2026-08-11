import { Project, SyntaxKind, ObjectLiteralExpression } from 'ts-morph';
import * as path from 'path';

// Ids that MUST have a corresponding *Name field in the payload
const INCLUDED_IDS = new Set([
  'productId',
  'vendorId',
  'supplierId',
  'customerId',
  'locationId',
  'fulfillmentLocationId',
  'taxCategoryId',
  'userId',
  'binId',
  'sourceLocationId',
  'destinationLocationId',
  'defaultFulfillmentLocationId',
  'sourceBinId',
  'destinationBinId',
  'targetBinId',
]);

// Ids that represent internal records, relations, or workflows and do NOT need a Name field
const EXCLUDED_IDS = new Set([
  'actorId',
  'contactId',
  'projectId',
  'noteId',
  'entityId',
  'salesOrderId',
  'salesOrderLineId',
  'purchaseOrderId',
  'returnId',
  'returnLineId',
  'shipmentId',
  'shipmentLineId',
  'transferOrderId',
  'pickId',
  'workOrderId',
  'workOrderComponentId',
  'workOrderPickId',
  'wipBinId',
  'backorderId',
  'inventoryId',
  'paymentId',
  'invoiceId',
  'creditNoteId',
  'zoneId',
  'bankStatementId',
  'bankStatementLineId',
  'glAccountId',
  'costCenterId',
  'activityId',
  'exchangeRateId',
  'discountMatrixId',
  'taxPositionId',
  'reconciliationRuleId',
  'businessReportId',
  'groupId',
  'addressId',
  'profileId',
  'ruleId',
  'matchedJournalLineId',
  'matchGroupId',
  'sourceId',
  'journalEntryId',
  'goodsReceivedId',
  'goodsReceivedLineId',
  'purchaseOrderLineId',
  'previousPurchaseOrderLineId',
  'previousPurchaseOrderId',
  'lineId',
  'invoiceLineId',
  'macroId',
  'allocationId',
  'referenceId',
  'deletedReportId',
  'componentId',
  'debitNoteId',
  'expiryId',
  'feedbackId',
  'itemId',
]);

describe('Event Payload Enrichment Audit', () => {
  it('should ensure all primary IDs in emitEvent payloads have corresponding names', () => {
    const project = new Project();
    project.addSourceFilesAtPaths(
      path.join(__dirname, '../../**/*.ts').replace(/\\/g, '/'),
    );
    const sourceFiles = project.getSourceFiles();

    const uncategorizedIds = new Set<string>();
    const missingNames: string[] = [];

    for (const sourceFile of sourceFiles) {
      // Skip test files, except this one if we want, but it's safe to skip all .spec.ts
      if (sourceFile.getFilePath().endsWith('.spec.ts')) continue;

      const callExpressions = sourceFile.getDescendantsOfKind(
        SyntaxKind.CallExpression,
      );

      for (const callExpr of callExpressions) {
        const expression = callExpr.getExpression();
        if (expression.getText() === 'emitEvent') {
          const args = callExpr.getArguments();
          if (args.length < 2) continue;

          // emitEvent(tx, params)
          const paramsArg = args[1];
          if (paramsArg.getKind() !== SyntaxKind.ObjectLiteralExpression)
            continue;

          const paramsObj = paramsArg as ObjectLiteralExpression;
          const payloadProp = paramsObj.getProperty('payload');

          if (
            !payloadProp ||
            payloadProp.getKind() !== SyntaxKind.PropertyAssignment
          )
            continue;

          // @ts-expect-error: Private typescript internal property
          const payloadInitializer = payloadProp.getInitializer();
          if (
            !payloadInitializer ||
            payloadInitializer.getKind() !== SyntaxKind.ObjectLiteralExpression
          )
            continue;

          const payloadObj = payloadInitializer as ObjectLiteralExpression;
          const properties = payloadObj.getProperties();

          const keysInPayload = new Set<string>();
          for (const prop of properties) {
            if (
              prop.getKind() === SyntaxKind.PropertyAssignment ||
              prop.getKind() === SyntaxKind.ShorthandPropertyAssignment
            ) {
              // @ts-expect-error: Private typescript internal method
              const name = prop.getName();
              keysInPayload.add(name);
            }
          }

          // Check all keys ending with 'Id'
          for (const key of keysInPayload) {
            if (key.endsWith('Id') && key !== 'Id') {
              if (!INCLUDED_IDS.has(key) && !EXCLUDED_IDS.has(key)) {
                uncategorizedIds.add(key);
              } else if (INCLUDED_IDS.has(key)) {
                // Determine expected name field
                let expectedNameKey = key.replace(/Id$/, 'Name');

                // Allow exact match without Id e.g. locationId -> location
                let fallbackNameKey = key.replace(/Id$/, '');

                if (
                  key === 'binId' ||
                  key === 'sourceBinId' ||
                  key === 'destinationBinId' ||
                  key === 'targetBinId'
                ) {
                  expectedNameKey = key.replace(/Id$/, 'Number');
                  fallbackNameKey =
                    key === 'binId'
                      ? 'binNumber'
                      : key.replace(/BinId$/, 'BinNumber');
                }

                if (
                  !keysInPayload.has(expectedNameKey) &&
                  !keysInPayload.has(fallbackNameKey)
                ) {
                  missingNames.push(
                    `${sourceFile.getFilePath()}:${callExpr.getStartLineNumber()} - Missing name for '${key}'`,
                  );
                }
              }
            }
          }
        }
      }
    }

    // Fail if there are any uncategorized IDs
    if (uncategorizedIds.size > 0) {
      throw new Error(
        `Found uncategorized IDs in emitEvent payloads. Please add them to INCLUDED_IDS or EXCLUDED_IDS: \n${Array.from(uncategorizedIds).join(', ')}`,
      );
    }

    // Fail if there are any missing names
    if (missingNames.length > 0) {
      throw new Error(
        `Found emitEvent calls missing enriched names for primary IDs:\n${missingNames.join('\n')}`,
      );
    }
  });
});
