import { IsString, IsOptional, IsUUID, IsBoolean } from 'class-validator';

export class CreateProjectFeedbackDto {
  @IsUUID()
  actorId!: string;

  @IsOptional()
  @IsString()
  dealProposalReason?: string;

  @IsOptional()
  @IsString()
  dealRefusalReason?: string;

  @IsOptional()
  @IsString()
  snapshotName?: string;

  @IsOptional()
  @IsString()
  asOfDate?: string;
}

export class UpdateProjectFeedbackDto {
  @IsOptional()
  @IsUUID()
  actorId?: string;

  @IsOptional()
  @IsString()
  dealProposalReason?: string;

  @IsOptional()
  @IsString()
  dealRefusalReason?: string;

  @IsOptional()
  @IsString()
  snapshotName?: string;

  @IsOptional()
  @IsString()
  asOfDate?: string;
}

export class ProjectFeedbackResponseDto {
  @IsUUID()
  feedbackId!: string;

  @IsUUID()
  projectId!: string;

  @IsUUID()
  actorId!: string;

  @IsOptional()
  @IsString()
  dealProposalReason?: string;

  @IsOptional()
  @IsString()
  dealRefusalReason?: string;

  @IsOptional()
  @IsString()
  snapshotName?: string;

  @IsOptional()
  @IsString()
  asOfDate?: string;

  @IsOptional()
  actor?: unknown;
}

export class CreateSellerQualificationDto {
  @IsOptional() @IsString() marketContext?: string;
  @IsOptional() @IsString() competitiveEnvironment?: string;
  @IsOptional() @IsString() marketTrends?: string;
  @IsOptional() @IsString() addedValue?: string;
  @IsOptional() @IsString() specificClients?: string;
  @IsOptional() @IsString() businessModel?: string;
  @IsOptional() @IsString() consolidationPerspectives?: string;
  @IsOptional() @IsBoolean() interestedBuyersExist?: boolean;
  @IsOptional() @IsString() snapshotName?: string;
  @IsOptional() @IsString() asOfDate?: string;
}

export class UpdateSellerQualificationDto extends CreateSellerQualificationDto {}

export class SellerQualificationResponseDto extends CreateSellerQualificationDto {
  @IsUUID() qualificationId!: string;
  @IsUUID() actorId!: string;
}

export class CreateBuyerQualificationDto {
  @IsOptional() @IsString() buyerActivity?: string;
  @IsOptional() @IsString() businessModel?: string;
  @IsOptional() @IsString() geography?: string;
  @IsOptional() @IsString() sizeCriteria?: string;
  @IsOptional() @IsString() financialCapacity?: string;
  @IsOptional() @IsString() strategicFit?: string;
  @IsOptional() @IsString() snapshotName?: string;
  @IsOptional() @IsString() asOfDate?: string;
}

export class UpdateBuyerQualificationDto extends CreateBuyerQualificationDto {}

export class BuyerQualificationResponseDto extends CreateBuyerQualificationDto {
  @IsUUID() qualificationId!: string;
  @IsUUID() actorId!: string;
}

export class CreateStrategicIntelligenceDto {
  @IsOptional() @IsString() managerIntent?: string;
  @IsOptional() @IsString() sectorInterests?: string;
  @IsOptional() @IsString() externalGrowthProjects?: string;
  @IsOptional() @IsString() futureSaleIntent?: string;
  @IsOptional() @IsString() timeline?: string;
  @IsOptional() @IsString() strategicRationale?: string;
  @IsOptional() @IsString() snapshotName?: string;
  @IsOptional() @IsString() asOfDate?: string;
}

export class UpdateStrategicIntelligenceDto extends CreateStrategicIntelligenceDto {}

export class StrategicIntelligenceResponseDto extends CreateStrategicIntelligenceDto {
  @IsUUID() intelligenceId!: string;
  @IsUUID() actorId!: string;
}
