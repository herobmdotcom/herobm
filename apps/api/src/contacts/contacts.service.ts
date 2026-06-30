import {
  Injectable,
  Inject,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { eq } from 'drizzle-orm';
import { DRIZZLE } from '../drizzle/drizzle.module';
import type { DrizzleDB } from '../drizzle/drizzle.module';
import { customerContacts, customers } from '../drizzle/herobm-core-schema';
import { CreateContactDto, UpdateContactDto, ContactResponseDto } from './dto';
import { emitEvent } from '../common/emit-event';
import { EntityType, EventType } from '../common/event-types';

@Injectable()
export class ContactsService {
  private readonly logger = new Logger(ContactsService.name);

  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  async createContact(dto: CreateContactDto): Promise<ContactResponseDto> {
    if (dto.entityType === 'customer') {
      // Verify customer exists
      const customer = await this.db.query.customers.findFirst({
        where: eq(customers.customerId, dto.entityId),
      });

      if (!customer) {
        throw new NotFoundException(
          `Customer with ID ${dto.entityId} not found`,
        );
      }

      const [newContact] = await this.db
        .insert(customerContacts)
        .values({
          customerId: dto.entityId,
          firstName: dto.firstName,
          lastName: dto.lastName,
          fullName: `${dto.firstName} ${dto.lastName}`.trim(),
          email: dto.email,
          phone: dto.phone,
          mobile: dto.mobile,
          jobTitle: dto.jobTitle,
          isPrimary: dto.isPrimary ?? false,
          source: 'app',
        })
        .returning();

      await emitEvent(this.db, {
        entityType: EntityType.CUSTOMER,
        entityId: dto.entityId,
        eventType: EventType.UPDATED,
        entityDisplayName: 'Customer',
        payload: { action: 'contact_created', contactId: newContact.id, contactName: newContact.fullName },
        actor: 'system',
      });

      return this.mapToDto(newContact);
    }

    throw new BadRequestException(
      `Unsupported entity type: ${String((dto as unknown as Record<string, unknown>).entityType)}`,
    );
  }

  async updateContact(
    id: string,
    dto: UpdateContactDto,
  ): Promise<ContactResponseDto> {
    // Currently only customerContacts exist.
    // If we add supplierContacts later, we'd need to search both or require entityType in the URL/body.
    // For now, assume it's a customer contact.
    const contact = await this.db.query.customerContacts.findFirst({
      where: eq(customerContacts.id, id),
    });

    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    const updatedFirstName = dto.firstName ?? contact.firstName;
    const updatedLastName = dto.lastName ?? contact.lastName;
    const fullName =
      `${updatedFirstName || ''} ${updatedLastName || ''}`.trim();

    const [updatedContact] = await this.db
      .update(customerContacts)
      .set({
        firstName: dto.firstName,
        lastName: dto.lastName,
        fullName: fullName || null,
        email: dto.email,
        phone: dto.phone,
        mobile: dto.mobile,
        jobTitle: dto.jobTitle,
        isPrimary: dto.isPrimary,
        modifiedOn: new Date(),
      })
      .where(eq(customerContacts.id, id))
      .returning();

    await emitEvent(this.db, {
      entityType: EntityType.CUSTOMER,
      entityId: contact.customerId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Customer',
      payload: { action: 'contact_updated', contactId: id, contactName: updatedContact.fullName },
      actor: 'system',
    });

    return this.mapToDto(updatedContact);
  }

  async deleteContact(id: string): Promise<void> {
    const contact = await this.db.query.customerContacts.findFirst({
      where: eq(customerContacts.id, id),
    });

    if (!contact) {
      throw new NotFoundException(`Contact with ID ${id} not found`);
    }

    await this.db.delete(customerContacts).where(eq(customerContacts.id, id));

    await emitEvent(this.db, {
      entityType: EntityType.CUSTOMER,
      entityId: contact.customerId,
      eventType: EventType.UPDATED,
      entityDisplayName: 'Customer',
      payload: { action: 'contact_deleted', contactId: id, contactName: contact.fullName },
      actor: 'system',
    });
  }

  private mapToDto(
    record: typeof customerContacts.$inferSelect,
  ): ContactResponseDto {
    return {
      id: record.id,
      firstName: record.firstName || '',
      lastName: record.lastName || '',
      email: record.email,
      phone: record.phone,
      mobile: record.mobile,
      jobTitle: record.jobTitle,
      isPrimary: record.isPrimary,
      createdOn: record.createdOn,
      modifiedOn: record.modifiedOn,
    };
  }
}
