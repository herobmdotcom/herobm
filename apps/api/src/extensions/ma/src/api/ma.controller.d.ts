import { MaService } from './ma.service';
import { CreateProjectFeedbackDto, UpdateProjectFeedbackDto, ProjectFeedbackResponseDto } from './dto';
export declare class MaController {
    private readonly maService;
    constructor(maService: MaService);
    getFeedback(id: string): Promise<ProjectFeedbackResponseDto[]>;
    addFeedback(id: string, dto: CreateProjectFeedbackDto): Promise<ProjectFeedbackResponseDto>;
    updateFeedback(id: string, feedbackId: string, dto: UpdateProjectFeedbackDto): Promise<ProjectFeedbackResponseDto>;
}
