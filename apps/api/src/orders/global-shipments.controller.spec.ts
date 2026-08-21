import { Test, TestingModule } from '@nestjs/testing';
import { GlobalShipmentsController } from './global-shipments.controller';
import { ShipmentsCoreService } from './shipments/shipments-core.service';
import { ShipmentsWriteService } from './shipments/shipments-write.service';
import { DocumentDispatchService } from '../notifications/document-dispatch.service';
import { DATA_SOURCE_CONTEXT } from '@herobm/shared';

describe('GlobalShipmentsController', () => {
  let controller: GlobalShipmentsController;
  let documentDispatchService: { emailDocument: jest.Mock };
  let shipmentsCoreService: { findAll: jest.Mock; findOne: jest.Mock };

  beforeEach(async () => {
    documentDispatchService = {
      emailDocument: jest.fn().mockResolvedValue({ success: true }),
    };

    shipmentsCoreService = {
      findAll: jest.fn().mockResolvedValue([]),
      findOne: jest.fn().mockResolvedValue({
        shipmentId: 'ship-1',
        shipmentNumber: 'SH-0001',
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [GlobalShipmentsController],
      providers: [
        {
          provide: ShipmentsCoreService,
          useValue: shipmentsCoreService,
        },
        {
          provide: ShipmentsWriteService,
          useValue: {},
        },
        {
          provide: DocumentDispatchService,
          useValue: documentDispatchService,
        },
      ],
    }).compile();

    controller = module.get<GlobalShipmentsController>(
      GlobalShipmentsController,
    );
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('emailDocument', () => {
    it('should queue shipment document for email dispatch', async () => {
      const dto = {
        hookSlug: 'shipping-docket',
        emailAddress: 'delivery@customer.com',
        subject: 'Shipping Docket: SH-0001',
        body: 'Your order has shipped.',
        customPdfText: 'Leave at front desk.',
      };

      const mockUser = {
        email: 'admin@herobm.com',
        username: 'admin',
        userId: 'u-1',
        orgId: 'org-1',
        role: 'admin',
      };

      const result = await controller.emailDocument(
        'ship-1',
        dto,
        mockUser as any,
      );

      expect(documentDispatchService.emailDocument).toHaveBeenCalledWith(
        {
          targetId: 'ship-1',
          hookSlug: 'shipping-docket',
          contextSlug: DATA_SOURCE_CONTEXT.SHIPMENT,
          entityType: 'shipment',
          entityId: 'ship-1',
          emailAddress: 'delivery@customer.com',
          subject: 'Shipping Docket: SH-0001',
          body: 'Your order has shipped.',
          customPdfText: 'Leave at front desk.',
          fallbackFileName: 'ShippingDocket-SH-0001.pdf',
        },
        mockUser,
      );

      expect(result).toEqual({ success: true });
    });
  });
});
