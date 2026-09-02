import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsObject } from 'class-validator';

export class PublishEventDto {
  @ApiProperty({
    description: 'The type of event to publish (e.g. order.created)',
  })
  @IsString()
  @IsNotEmpty()
  type: string;

  @ApiProperty({ description: 'The payload of the event' })
  @IsObject()
  payload: Record<string, unknown>;
}

export class PublishEventResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty()
  outboxId!: string;
}
