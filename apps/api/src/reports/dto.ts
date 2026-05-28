import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class EmptyBodyDto {}

export class HookDto {
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty() description!: string;
  @ApiProperty({ type: [String] }) contexts!: string[];
}

export class ReportDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty({ required: false }) description?: string;
  @ApiProperty() template!: string;
  @ApiProperty({ required: false }) outputNamePattern?: string;
  @ApiProperty({ type: [String], required: false }) contexts?: string[];
  @ApiProperty() isSystem!: boolean;
}

export class HooksResponseDto {
  @ApiProperty({ type: [HookDto] }) data!: HookDto[];
}

export class ReportsResponseDto {
  @ApiProperty({ type: [ReportDto] }) data!: ReportDto[];
}

export class ReportResponseDto {
  @ApiProperty({ type: ReportDto }) data!: ReportDto;
}

export class HookAssignmentDto {
  @ApiProperty() hookSlug!: string;
  @ApiProperty() reportId!: string;
  @ApiProperty() contextSlug!: string;
}

export class HookAssignmentsResponseDto {
  @ApiProperty({ type: [HookAssignmentDto] }) data!: HookAssignmentDto[];
}

class RandomIdData {
  @ApiProperty() id!: string;
}

export class RandomIdResponseDto {
  @ApiProperty({ type: RandomIdData }) data!: RandomIdData;
}

export class CreateReportDto {
  @ApiProperty() name!: string;
  @ApiProperty() slug!: string;
  @ApiProperty({ required: false }) description?: string;
  @ApiProperty() template!: string;
  @ApiProperty({ required: false }) outputNamePattern?: string;
  @ApiProperty({ type: [String], required: false }) contexts?: string[];
}

export class UpdateReportDto {
  @ApiProperty({ required: false }) name?: string;
  @ApiProperty({ required: false }) slug?: string;
  @ApiProperty({ required: false }) description?: string;
  @ApiProperty({ required: false }) template?: string;
  @ApiProperty({ required: false }) outputNamePattern?: string;
  @ApiProperty({ type: [String], required: false }) contexts?: string[];
}

export class PreviewReportDto {
  @ApiProperty() template!: string;
  @ApiProperty({ required: false }) mockData?: any;
  @ApiProperty({ required: false }) hookSlug?: string;
  @ApiProperty({ required: false }) entityId?: string;
}

export class UpdateHookAssignmentDto {
  @IsString()
  @IsOptional()
  reportId?: string;

  @IsString()
  @IsOptional()
  contextSlug?: string;
}

export class RunHookBodyDto {
  [key: string]: any;
}
