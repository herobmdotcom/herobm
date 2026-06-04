import { ApiProperty } from '@nestjs/swagger';

export class DataSourceItemDto {
  @ApiProperty()
  slug!: string;

  @ApiProperty()
  name!: string;
}

export class SampleReportDto {
  @ApiProperty()
  isMockData!: boolean;

  @ApiProperty({ type: [Object] })
  data!: any[];
}

export class SampleRecordDto {
  @ApiProperty()
  isMockData!: boolean;

  @ApiProperty({ type: Object })
  data!: any;
}
