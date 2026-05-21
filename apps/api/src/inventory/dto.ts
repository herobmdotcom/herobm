import {
  IsString,
  IsNotEmpty,
  IsOptional,
  IsArray,
  ValidateNested,
  IsNumberString,
  IsIn,
} from 'class-validator';
import { Type } from 'class-transformer';

export class PutawayLineDto {
  @IsString()
  @IsNotEmpty()
  lineId!: string;

  @IsString()
  @IsNotEmpty()
  @IsIn(['goods_receipt', 'sales_return'])
  sourceType!: 'goods_receipt' | 'sales_return';

  @IsString()
  @IsNotEmpty()
  destinationBinId!: string;

  @IsNumberString()
  quantity!: string;

  @IsOptional()
  @IsNumberString()
  newTotalQuantity?: string;
}

export class PutawayBulkDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PutawayLineDto)
  putaways!: PutawayLineDto[];
}

export class ToggleQuarantineDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['goods_receipt', 'sales_return'])
  sourceType!: 'goods_receipt' | 'sales_return';

  @IsOptional()
  @IsString()
  reason?: string;
}
