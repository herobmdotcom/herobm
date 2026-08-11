import { ApiProperty } from '@nestjs/swagger';

export class SystemLogResponseDto {
  @ApiProperty({ description: 'Array of log lines', type: [String] })
  lines: string[];
}

export class SystemVersionResponseDto {
  @ApiProperty({ description: 'API version number' })
  apiVersion: string;

  @ApiProperty({ description: 'API build timestamp' })
  apiBuildTime: string;

  @ApiProperty({ description: 'Node.js version' })
  nodeVersion: string;

  @ApiProperty({ description: 'OS platform' })
  osPlatform: string;

  @ApiProperty({ description: 'OS release' })
  osRelease: string;
}
