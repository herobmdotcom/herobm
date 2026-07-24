import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsEmail,
  IsBoolean,
  IsUUID,
  IsArray,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class CreateActorDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  legalStatus?: string;

  @IsOptional()
  @IsString()
  headquartersAddressLine1?: string;
  @IsOptional()
  @IsString()
  headquartersAddressLine2?: string;
  @IsOptional()
  @IsString()
  headquartersCity?: string;
  @IsOptional()
  @IsString()
  headquartersStateOrProvince?: string;
  @IsOptional()
  @IsString()
  headquartersPostalCode?: string;
  @IsOptional()
  @IsString()
  headquartersCountry?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsString()
  fax?: string;

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
  @IsString()
  businessNumber?: string;

  @IsOptional()
  @IsBoolean()
  isTaxRegistered?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class UpdateActorDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  legalStatus?: string;

  @IsOptional()
  @IsString()
  headquartersAddressLine1?: string;
  @IsOptional()
  @IsString()
  headquartersAddressLine2?: string;
  @IsOptional()
  @IsString()
  headquartersCity?: string;
  @IsOptional()
  @IsString()
  headquartersStateOrProvince?: string;
  @IsOptional()
  @IsString()
  headquartersPostalCode?: string;
  @IsOptional()
  @IsString()
  headquartersCountry?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsString()
  fax?: string;

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
  @IsString()
  businessNumber?: string;

  @IsOptional()
  @IsBoolean()
  isTaxRegistered?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}

export class CreateActorNoteDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class ActorNoteResponseDto {
  @IsUUID()
  noteId!: string;

  @IsString()
  content!: string;

  @IsString()
  createdOn!: Date;

  @IsOptional()
  @IsString()
  createdById?: string;

  @IsOptional()
  createdBy?: unknown;
}

export class ActorResponseDto {
  @IsUUID()
  actorId!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  legalStatus?: string;

  @IsOptional()
  @IsString()
  headquartersAddressLine1?: string;
  headquartersAddressLine2?: string;
  headquartersCity?: string;
  headquartersStateOrProvince?: string;
  headquartersPostalCode?: string;
  headquartersCountry?: string;

  @IsOptional()
  @IsString()
  website?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  telephone?: string;

  @IsOptional()
  @IsString()
  fax?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  businessNumber?: string;

  @IsBoolean()
  isTaxRegistered!: boolean;

  @IsString()
  createdOn!: Date;

  @IsString()
  modifiedOn!: Date;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  notes?: ActorNoteResponseDto[];

  @IsOptional()
  actorContactLinks?: unknown[];

  @IsOptional()
  events?: unknown[];
}

import { ApiProperty } from '@nestjs/swagger';

export class UpdateActorContactDto {
  @ApiProperty({ required: true, type: [String] })
  @IsArray()
  @IsString({ each: true })
  primaryFor!: string[];
}

export class CreateActorContactDto {
  @ApiProperty({ required: true, type: String })
  @IsUUID()
  contactId!: string;

  @ApiProperty({ required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  primaryFor?: string[];
}
