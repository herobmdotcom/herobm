export declare class CreateProjectFeedbackDto {
    actorId: string;
    dealProposalReason?: string;
    dealRefusalReason?: string;
    snapshotName?: string;
    asOfDate?: string;
}
export declare class UpdateProjectFeedbackDto {
    actorId?: string;
    dealProposalReason?: string;
    dealRefusalReason?: string;
    snapshotName?: string;
    asOfDate?: string;
}
export declare class ProjectFeedbackResponseDto {
    feedbackId: string;
    projectId: string;
    actorId: string;
    dealProposalReason?: string;
    dealRefusalReason?: string;
    snapshotName?: string;
    asOfDate?: string;
    actor?: unknown;
}
export declare class CreateSellerQualificationDto {
    marketContext?: string;
    competitiveEnvironment?: string;
    marketTrends?: string;
    addedValue?: string;
    specificClients?: string;
    businessModel?: string;
    consolidationPerspectives?: string;
    interestedBuyersExist?: boolean;
    snapshotName?: string;
    asOfDate?: string;
}
export declare class UpdateSellerQualificationDto extends CreateSellerQualificationDto {
}
export declare class SellerQualificationResponseDto extends CreateSellerQualificationDto {
    qualificationId: string;
    actorId: string;
}
export declare class CreateBuyerQualificationDto {
    buyerActivity?: string;
    businessModel?: string;
    geography?: string;
    sizeCriteria?: string;
    financialCapacity?: string;
    strategicFit?: string;
    snapshotName?: string;
    asOfDate?: string;
}
export declare class UpdateBuyerQualificationDto extends CreateBuyerQualificationDto {
}
export declare class BuyerQualificationResponseDto extends CreateBuyerQualificationDto {
    qualificationId: string;
    actorId: string;
}
export declare class CreateStrategicIntelligenceDto {
    managerIntent?: string;
    sectorInterests?: string;
    externalGrowthProjects?: string;
    futureSaleIntent?: string;
    timeline?: string;
    strategicRationale?: string;
    snapshotName?: string;
    asOfDate?: string;
}
export declare class UpdateStrategicIntelligenceDto extends CreateStrategicIntelligenceDto {
}
export declare class StrategicIntelligenceResponseDto extends CreateStrategicIntelligenceDto {
    intelligenceId: string;
    actorId: string;
}
