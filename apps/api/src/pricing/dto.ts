import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsUUID,
  IsNumberString,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateDiscountMatrixDto {
  @ApiProperty({ format: 'uuid', required: false })
  @IsOptional()
  @IsUUID()
  customerGroupId?: string;

  @ApiProperty({ format: 'uuid', required: false })
  @IsOptional()
  @IsUUID()
  customerId?: string;

  @ApiProperty({ format: 'uuid', required: false })
  @IsOptional()
  @IsUUID()
  productGroupId?: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsNumberString()
  discountPercentage!: string;
}

export class UpdateDiscountMatrixDto {
  @ApiProperty({ required: false })
  @IsOptional()
  @IsNumberString()
  discountPercentage?: string;
}

export class DiscountMatrixResponseDto {
  @ApiProperty({ format: 'uuid' })
  discountMatrixId!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  customerGroupId!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  customerId!: string | null;

  @ApiProperty({ format: 'uuid', nullable: true })
  productGroupId!: string | null;

  @ApiProperty()
  discountPercentage!: string;

  @ApiProperty({ format: 'date-time', nullable: true })
  createdOn!: Date | null;

  @ApiProperty({ format: 'date-time', nullable: true })
  modifiedOn!: Date | null;
}

export class ResolveDiscountRuleDto {
  @ApiProperty()
  ownerType!: 'customer' | 'customer_group';

  @ApiProperty({ format: 'uuid', nullable: true })
  productGroupId!: string | null;

  @ApiProperty()
  discountPercentage!: string;
}

export class DeleteDiscountMatrixResponseDto {
  @ApiProperty()
  deleted!: boolean;
}
