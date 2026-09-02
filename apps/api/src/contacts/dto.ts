import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsUUID,
  IsBoolean,
  IsIn,
  IsArray,
  Matches,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateContactDto {
  @IsOptional()
  @IsString()
  @IsIn(['customer', 'actor', 'project'])
  entityType?: 'customer' | 'actor' | 'project';

  @IsOptional()
  @IsUUID()
  entityId?: string;

  @IsString()
  @IsNotEmpty()
  firstName!: string;

  @IsString()
  @IsNotEmpty()
  lastName!: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === ''
      ? null
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  @IsEmail()
  email?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === ''
      ? null
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  @Matches(/^\+?[0-9\s\-()]+$/, {
    message: 'Phone number contains invalid characters',
  })
  phone?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === ''
      ? null
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  @Matches(/^\+?[0-9\s\-()]+$/, {
    message: 'Mobile number contains invalid characters',
  })
  mobile?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  /** @deprecated use primaryFor or projectRole instead */
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  primaryFor?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  projectRoles?: string[];
}

export class UpdateContactDto {
  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === ''
      ? null
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  @IsEmail()
  email?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === ''
      ? null
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  @Matches(/^\+?[0-9\s\-()]+$/, {
    message: 'Phone number contains invalid characters',
  })
  phone?: string;

  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' && value.trim() === ''
      ? null
      : typeof value === 'string'
        ? value.trim()
        : value,
  )
  @Matches(/^\+?[0-9\s\-()]+$/, {
    message: 'Mobile number contains invalid characters',
  })
  mobile?: string;

  @IsOptional()
  @IsString()
  jobTitle?: string;

  /** @deprecated use primaryFor or projectRole instead */
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  primaryFor?: string[];

  @IsOptional()
  @IsString()
  projectRole?: string;
}

export enum ActorRole {
  PURCHASING = 'purchasing',
  BILLING = 'billing',
  SALES = 'sales',
  TECHNICAL = 'technical',
}

export class ContactResponseDto {
  contactId!: string;
  stateCode!: string;
  firstName!: string;
  lastName!: string;
  fullName?: string | null;
  email?: string | null;
  phone?: string | null;
  mobile?: string | null;
  jobTitle?: string | null;
  primaryFor?: string[];
  createdOn!: Date | null;
  modifiedOn!: Date | null;
}

export class EmptyBodyDto {}

export class SuccessResponseDto {
  success!: boolean;
}
