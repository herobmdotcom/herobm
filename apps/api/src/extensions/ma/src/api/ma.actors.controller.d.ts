import { MaService } from './ma.service';
import { CreateSellerQualificationDto, UpdateSellerQualificationDto, SellerQualificationResponseDto, CreateBuyerQualificationDto, UpdateBuyerQualificationDto, BuyerQualificationResponseDto, CreateStrategicIntelligenceDto, UpdateStrategicIntelligenceDto, StrategicIntelligenceResponseDto } from './dto';
export declare class MaActorsController {
    private readonly maService;
    constructor(maService: MaService);
    getSellerQualifications(id: string): Promise<SellerQualificationResponseDto[]>;
    addSellerQualification(id: string, dto: CreateSellerQualificationDto): Promise<SellerQualificationResponseDto>;
    updateSellerQualification(id: string, qualificationId: string, dto: UpdateSellerQualificationDto): Promise<SellerQualificationResponseDto>;
    getBuyerQualifications(id: string): Promise<BuyerQualificationResponseDto[]>;
    addBuyerQualification(id: string, dto: CreateBuyerQualificationDto): Promise<BuyerQualificationResponseDto>;
    updateBuyerQualification(id: string, qualificationId: string, dto: UpdateBuyerQualificationDto): Promise<BuyerQualificationResponseDto>;
    getStrategicIntelligence(id: string): Promise<StrategicIntelligenceResponseDto[]>;
    addStrategicIntelligence(id: string, dto: CreateStrategicIntelligenceDto): Promise<StrategicIntelligenceResponseDto>;
    updateStrategicIntelligence(id: string, intelligenceId: string, dto: UpdateStrategicIntelligenceDto): Promise<StrategicIntelligenceResponseDto>;
}
