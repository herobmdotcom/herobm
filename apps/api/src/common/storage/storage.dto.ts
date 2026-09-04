import { ApiProperty } from '@nestjs/swagger';

export class StorageFileResponseDto {
  @ApiProperty({ description: 'Relative path to the stored file' })
  storagePath!: string;

  @ApiProperty({ description: 'Original filename' })
  fileName!: string;

  @ApiProperty({ description: 'MIME type of the file' })
  mimeType!: string;

  @ApiProperty({ description: 'File size in bytes' })
  byteSize!: number;
}

export class StorageDeleteResponseDto {
  @ApiProperty({ description: 'Indicates whether the deletion succeeded' })
  success!: boolean;
}
