import { Injectable, Inject, NotFoundException, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { customerDeliveryAddresses, customers } from '../drizzle/schema';
import {
  CreateDeliveryAddressDto,
  UpdateDeliveryAddressDto,
  DeliveryAddressResponseDto,
} from './dto';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';

@Injectable()
export class DeliveryAddressesService {
  private readonly logger = new Logger(DeliveryAddressesService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async createDeliveryAddress(
    dto: CreateDeliveryAddressDto,
  ): Promise<DeliveryAddressResponseDto> {
    const customer = await this.db.query.customers.findFirst({
      where: eq(customers.customerId, dto.customerId),
    });

    if (!customer) {
      throw new NotFoundException(
        `Customer with ID ${dto.customerId} not found`,
      );
    }

    const [inserted] = await this.db
      .insert(customerDeliveryAddresses)
      .values({
        customerId: dto.customerId,
        addressName: dto.addressName,
        companyName: dto.companyName,
        recipientName: dto.recipientName,
        recipientPhone: dto.recipientPhone,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        stateOrProvince: dto.stateOrProvince,
        postalCode: dto.postalCode,
        country: dto.country,
        isPrimary: dto.isPrimary ?? false,
        source: 'app',
      })
      .returning();

    await emitEvent(this.db, {
      entityType: EntityType.CUSTOMER,
      entityId: dto.customerId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Customer',
      payload: { action: 'delivery_address_created', addressId: inserted.id },
      actor: 'system',
    });

    return {
      ...inserted,
      deliveryAddressId: inserted.id,
    } as unknown as DeliveryAddressResponseDto;
  }

  async updateDeliveryAddress(
    id: string,
    dto: UpdateDeliveryAddressDto,
  ): Promise<DeliveryAddressResponseDto> {
    const existing = await this.db.query.customerDeliveryAddresses.findFirst({
      where: eq(customerDeliveryAddresses.id, id),
    });

    if (!existing) {
      throw new NotFoundException(`Delivery Address with ID ${id} not found`);
    }

    const [updated] = await this.db
      .update(customerDeliveryAddresses)
      .set({
        addressName: dto.addressName,
        companyName: dto.companyName,
        recipientName: dto.recipientName,
        recipientPhone: dto.recipientPhone,
        addressLine1: dto.addressLine1,
        addressLine2: dto.addressLine2,
        city: dto.city,
        stateOrProvince: dto.stateOrProvince,
        postalCode: dto.postalCode,
        country: dto.country,
        isPrimary: dto.isPrimary,
        modifiedOn: new Date(),
      })
      .where(eq(customerDeliveryAddresses.id, id))
      .returning();

    await emitEvent(this.db, {
      entityType: EntityType.CUSTOMER,
      entityId: existing.customerId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Customer',
      payload: { action: 'delivery_address_updated', addressId: id },
      actor: 'system',
    });

    return {
      ...updated,
      deliveryAddressId: updated.id,
    } as unknown as DeliveryAddressResponseDto;
  }

  async deleteDeliveryAddress(id: string): Promise<{ success: boolean }> {
    const existing = await this.db.query.customerDeliveryAddresses.findFirst({
      where: eq(customerDeliveryAddresses.id, id),
    });

    if (!existing) {
      throw new NotFoundException(`Delivery Address with ID ${id} not found`);
    }

    await this.db
      .delete(customerDeliveryAddresses)
      .where(eq(customerDeliveryAddresses.id, id));

    await emitEvent(this.db, {
      entityType: EntityType.CUSTOMER,
      entityId: existing.customerId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Customer',
      payload: { action: 'delivery_address_deleted', addressId: id },
      actor: 'system',
    });

    return { success: true };
  }
}
