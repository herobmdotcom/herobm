import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty } from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty({
    description:
      'The Casbin role granted to this API key (e.g. agent, webhook)',
  })
  @IsString()
  @IsNotEmpty()
  role!: string;
}

export class ApiKeyResponseDto {
  @ApiProperty({ format: 'uuid' })
  apiKeyId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  prefix!: string;

  @ApiProperty()
  role!: string;

  @ApiProperty({ format: 'date-time' })
  createdOn!: Date;
}

export class ApiKeyFullResponseDto {
  @ApiProperty({ format: 'uuid' })
  apiKeyId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty()
  prefix!: string;

  @ApiProperty()
  role!: string;

  @ApiProperty()
  keyHash!: string;

  @ApiProperty()
  createdBy!: string;

  @ApiProperty({ format: 'date-time' })
  createdOn!: Date;

  @ApiProperty({ format: 'date-time' })
  modifiedOn!: Date;
}

export class ApiKeyCreatedResponseDto extends ApiKeyFullResponseDto {
  @ApiProperty()
  secretKey!: string;
}
