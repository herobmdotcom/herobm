"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StrategicIntelligenceResponseDto = exports.UpdateStrategicIntelligenceDto = exports.CreateStrategicIntelligenceDto = exports.BuyerQualificationResponseDto = exports.UpdateBuyerQualificationDto = exports.CreateBuyerQualificationDto = exports.SellerQualificationResponseDto = exports.UpdateSellerQualificationDto = exports.CreateSellerQualificationDto = exports.ProjectFeedbackResponseDto = exports.UpdateProjectFeedbackDto = exports.CreateProjectFeedbackDto = void 0;
const openapi = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
class CreateProjectFeedbackDto {
    actorId;
    dealProposalReason;
    dealRefusalReason;
    snapshotName;
    asOfDate;
    static _OPENAPI_METADATA_FACTORY() {
        return { actorId: { required: true, type: () => String, format: "uuid" }, dealProposalReason: { required: false, type: () => String }, dealRefusalReason: { required: false, type: () => String }, snapshotName: { required: false, type: () => String }, asOfDate: { required: false, type: () => String } };
    }
}
exports.CreateProjectFeedbackDto = CreateProjectFeedbackDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CreateProjectFeedbackDto.prototype, "actorId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateProjectFeedbackDto.prototype, "dealProposalReason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateProjectFeedbackDto.prototype, "dealRefusalReason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateProjectFeedbackDto.prototype, "snapshotName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateProjectFeedbackDto.prototype, "asOfDate", void 0);
class UpdateProjectFeedbackDto {
    actorId;
    dealProposalReason;
    dealRefusalReason;
    snapshotName;
    asOfDate;
    static _OPENAPI_METADATA_FACTORY() {
        return { actorId: { required: false, type: () => String, format: "uuid" }, dealProposalReason: { required: false, type: () => String }, dealRefusalReason: { required: false, type: () => String }, snapshotName: { required: false, type: () => String }, asOfDate: { required: false, type: () => String } };
    }
}
exports.UpdateProjectFeedbackDto = UpdateProjectFeedbackDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], UpdateProjectFeedbackDto.prototype, "actorId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateProjectFeedbackDto.prototype, "dealProposalReason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateProjectFeedbackDto.prototype, "dealRefusalReason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateProjectFeedbackDto.prototype, "snapshotName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], UpdateProjectFeedbackDto.prototype, "asOfDate", void 0);
class ProjectFeedbackResponseDto {
    feedbackId;
    projectId;
    actorId;
    dealProposalReason;
    dealRefusalReason;
    snapshotName;
    asOfDate;
    actor;
    static _OPENAPI_METADATA_FACTORY() {
        return { feedbackId: { required: true, type: () => String, format: "uuid" }, projectId: { required: true, type: () => String, format: "uuid" }, actorId: { required: true, type: () => String, format: "uuid" }, dealProposalReason: { required: false, type: () => String }, dealRefusalReason: { required: false, type: () => String }, snapshotName: { required: false, type: () => String }, asOfDate: { required: false, type: () => String }, actor: { required: false, type: () => Object } };
    }
}
exports.ProjectFeedbackResponseDto = ProjectFeedbackResponseDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ProjectFeedbackResponseDto.prototype, "feedbackId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ProjectFeedbackResponseDto.prototype, "projectId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], ProjectFeedbackResponseDto.prototype, "actorId", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ProjectFeedbackResponseDto.prototype, "dealProposalReason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ProjectFeedbackResponseDto.prototype, "dealRefusalReason", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ProjectFeedbackResponseDto.prototype, "snapshotName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], ProjectFeedbackResponseDto.prototype, "asOfDate", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], ProjectFeedbackResponseDto.prototype, "actor", void 0);
class CreateSellerQualificationDto {
    marketContext;
    competitiveEnvironment;
    marketTrends;
    addedValue;
    specificClients;
    businessModel;
    consolidationPerspectives;
    interestedBuyersExist;
    snapshotName;
    asOfDate;
    static _OPENAPI_METADATA_FACTORY() {
        return { marketContext: { required: false, type: () => String }, competitiveEnvironment: { required: false, type: () => String }, marketTrends: { required: false, type: () => String }, addedValue: { required: false, type: () => String }, specificClients: { required: false, type: () => String }, businessModel: { required: false, type: () => String }, consolidationPerspectives: { required: false, type: () => String }, interestedBuyersExist: { required: false, type: () => Boolean }, snapshotName: { required: false, type: () => String }, asOfDate: { required: false, type: () => String } };
    }
}
exports.CreateSellerQualificationDto = CreateSellerQualificationDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSellerQualificationDto.prototype, "marketContext", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSellerQualificationDto.prototype, "competitiveEnvironment", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSellerQualificationDto.prototype, "marketTrends", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSellerQualificationDto.prototype, "addedValue", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSellerQualificationDto.prototype, "specificClients", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSellerQualificationDto.prototype, "businessModel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSellerQualificationDto.prototype, "consolidationPerspectives", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], CreateSellerQualificationDto.prototype, "interestedBuyersExist", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSellerQualificationDto.prototype, "snapshotName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateSellerQualificationDto.prototype, "asOfDate", void 0);
class UpdateSellerQualificationDto extends CreateSellerQualificationDto {
    static _OPENAPI_METADATA_FACTORY() {
        return {};
    }
}
exports.UpdateSellerQualificationDto = UpdateSellerQualificationDto;
class SellerQualificationResponseDto extends CreateSellerQualificationDto {
    qualificationId;
    actorId;
    static _OPENAPI_METADATA_FACTORY() {
        return { qualificationId: { required: true, type: () => String, format: "uuid" }, actorId: { required: true, type: () => String, format: "uuid" } };
    }
}
exports.SellerQualificationResponseDto = SellerQualificationResponseDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SellerQualificationResponseDto.prototype, "qualificationId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SellerQualificationResponseDto.prototype, "actorId", void 0);
class CreateBuyerQualificationDto {
    buyerActivity;
    businessModel;
    geography;
    sizeCriteria;
    financialCapacity;
    strategicFit;
    snapshotName;
    asOfDate;
    static _OPENAPI_METADATA_FACTORY() {
        return { buyerActivity: { required: false, type: () => String }, businessModel: { required: false, type: () => String }, geography: { required: false, type: () => String }, sizeCriteria: { required: false, type: () => String }, financialCapacity: { required: false, type: () => String }, strategicFit: { required: false, type: () => String }, snapshotName: { required: false, type: () => String }, asOfDate: { required: false, type: () => String } };
    }
}
exports.CreateBuyerQualificationDto = CreateBuyerQualificationDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBuyerQualificationDto.prototype, "buyerActivity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBuyerQualificationDto.prototype, "businessModel", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBuyerQualificationDto.prototype, "geography", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBuyerQualificationDto.prototype, "sizeCriteria", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBuyerQualificationDto.prototype, "financialCapacity", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBuyerQualificationDto.prototype, "strategicFit", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBuyerQualificationDto.prototype, "snapshotName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateBuyerQualificationDto.prototype, "asOfDate", void 0);
class UpdateBuyerQualificationDto extends CreateBuyerQualificationDto {
    static _OPENAPI_METADATA_FACTORY() {
        return {};
    }
}
exports.UpdateBuyerQualificationDto = UpdateBuyerQualificationDto;
class BuyerQualificationResponseDto extends CreateBuyerQualificationDto {
    qualificationId;
    actorId;
    static _OPENAPI_METADATA_FACTORY() {
        return { qualificationId: { required: true, type: () => String, format: "uuid" }, actorId: { required: true, type: () => String, format: "uuid" } };
    }
}
exports.BuyerQualificationResponseDto = BuyerQualificationResponseDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], BuyerQualificationResponseDto.prototype, "qualificationId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], BuyerQualificationResponseDto.prototype, "actorId", void 0);
class CreateStrategicIntelligenceDto {
    managerIntent;
    sectorInterests;
    externalGrowthProjects;
    futureSaleIntent;
    timeline;
    strategicRationale;
    snapshotName;
    asOfDate;
    static _OPENAPI_METADATA_FACTORY() {
        return { managerIntent: { required: false, type: () => String }, sectorInterests: { required: false, type: () => String }, externalGrowthProjects: { required: false, type: () => String }, futureSaleIntent: { required: false, type: () => String }, timeline: { required: false, type: () => String }, strategicRationale: { required: false, type: () => String }, snapshotName: { required: false, type: () => String }, asOfDate: { required: false, type: () => String } };
    }
}
exports.CreateStrategicIntelligenceDto = CreateStrategicIntelligenceDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateStrategicIntelligenceDto.prototype, "managerIntent", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateStrategicIntelligenceDto.prototype, "sectorInterests", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateStrategicIntelligenceDto.prototype, "externalGrowthProjects", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateStrategicIntelligenceDto.prototype, "futureSaleIntent", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateStrategicIntelligenceDto.prototype, "timeline", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateStrategicIntelligenceDto.prototype, "strategicRationale", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateStrategicIntelligenceDto.prototype, "snapshotName", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    __metadata("design:type", String)
], CreateStrategicIntelligenceDto.prototype, "asOfDate", void 0);
class UpdateStrategicIntelligenceDto extends CreateStrategicIntelligenceDto {
    static _OPENAPI_METADATA_FACTORY() {
        return {};
    }
}
exports.UpdateStrategicIntelligenceDto = UpdateStrategicIntelligenceDto;
class StrategicIntelligenceResponseDto extends CreateStrategicIntelligenceDto {
    intelligenceId;
    actorId;
    static _OPENAPI_METADATA_FACTORY() {
        return { intelligenceId: { required: true, type: () => String, format: "uuid" }, actorId: { required: true, type: () => String, format: "uuid" } };
    }
}
exports.StrategicIntelligenceResponseDto = StrategicIntelligenceResponseDto;
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], StrategicIntelligenceResponseDto.prototype, "intelligenceId", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], StrategicIntelligenceResponseDto.prototype, "actorId", void 0);
//# sourceMappingURL=dto.js.map