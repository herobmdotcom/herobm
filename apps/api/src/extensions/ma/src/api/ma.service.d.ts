import type { DrizzleDB } from '@api/drizzle/drizzle.module';
import { CreateProjectFeedbackDto, UpdateProjectFeedbackDto, ProjectFeedbackResponseDto, CreateSellerQualificationDto, UpdateSellerQualificationDto, SellerQualificationResponseDto, CreateBuyerQualificationDto, UpdateBuyerQualificationDto, BuyerQualificationResponseDto, CreateStrategicIntelligenceDto, UpdateStrategicIntelligenceDto, StrategicIntelligenceResponseDto } from './dto';
export declare class MaService {
    private readonly db;
    constructor(db: DrizzleDB);
    getFeedback(projectId: string): Promise<ProjectFeedbackResponseDto[]>;
    addFeedback(projectId: string, dto: CreateProjectFeedbackDto): Promise<ProjectFeedbackResponseDto>;
    updateFeedback(projectId: string, feedbackId: string, dto: UpdateProjectFeedbackDto): Promise<ProjectFeedbackResponseDto>;
    private getFeedbackById;
    private touchProject;
    getSellerQualifications(actorId: string): Promise<SellerQualificationResponseDto[]>;
    addSellerQualification(actorId: string, dto: CreateSellerQualificationDto): Promise<SellerQualificationResponseDto>;
    updateSellerQualification(actorId: string, qualificationId: string, dto: UpdateSellerQualificationDto): Promise<SellerQualificationResponseDto>;
    getBuyerQualifications(actorId: string): Promise<BuyerQualificationResponseDto[]>;
    addBuyerQualification(actorId: string, dto: CreateBuyerQualificationDto): Promise<BuyerQualificationResponseDto>;
    updateBuyerQualification(actorId: string, qualificationId: string, dto: UpdateBuyerQualificationDto): Promise<BuyerQualificationResponseDto>;
    getStrategicIntelligence(actorId: string): Promise<StrategicIntelligenceResponseDto[]>;
    addStrategicIntelligence(actorId: string, dto: CreateStrategicIntelligenceDto): Promise<StrategicIntelligenceResponseDto>;
    updateStrategicIntelligence(actorId: string, intelligenceId: string, dto: UpdateStrategicIntelligenceDto): Promise<StrategicIntelligenceResponseDto>;
    private emitActorUpdate;
    private touchActor;
}


