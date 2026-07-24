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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaActorsController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const swagger_1 = require("@nestjs/swagger");
const ma_service_1 = require("./ma.service");
const dto_1 = require("./dto");
const shared_1 = require("@herobm/shared");
const casbin_guard_1 = require("../../../../apps/api/src/auth/casbin.guard");
let MaActorsController = class MaActorsController {
    maService;
    constructor(maService) {
        this.maService = maService;
    }
    getSellerQualifications(id) {
        return this.maService.getSellerQualifications(id);
    }
    addSellerQualification(id, dto) {
        return this.maService.addSellerQualification(id, dto);
    }
    updateSellerQualification(id, qualificationId, dto) {
        return this.maService.updateSellerQualification(id, qualificationId, dto);
    }
    getBuyerQualifications(id) {
        return this.maService.getBuyerQualifications(id);
    }
    addBuyerQualification(id, dto) {
        return this.maService.addBuyerQualification(id, dto);
    }
    updateBuyerQualification(id, qualificationId, dto) {
        return this.maService.updateBuyerQualification(id, qualificationId, dto);
    }
    getStrategicIntelligence(id) {
        return this.maService.getStrategicIntelligence(id);
    }
    addStrategicIntelligence(id, dto) {
        return this.maService.addStrategicIntelligence(id, dto);
    }
    updateStrategicIntelligence(id, intelligenceId, dto) {
        return this.maService.updateStrategicIntelligence(id, intelligenceId, dto);
    }
};
exports.MaActorsController = MaActorsController;
__decorate([
    (0, common_1.Get)(':id/seller-qualifications'),
    (0, casbin_guard_1.CasbinAction)('read'),
    (0, swagger_1.ApiOperation)({ summary: 'Get Seller Qualifications', operationId: 'maGetSellerQualifications' }),
    (0, swagger_1.ApiParam)({ name: 'id', required: true }),
    (0, swagger_1.ApiOkResponse)({ type: [dto_1.SellerQualificationResponseDto] }),
    openapi.ApiResponse({ status: 200, type: [require("./dto").SellerQualificationResponseDto] }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MaActorsController.prototype, "getSellerQualifications", null);
__decorate([
    (0, common_1.Post)(':id/seller-qualifications'),
    (0, casbin_guard_1.CasbinAction)('write'),
    (0, swagger_1.ApiOperation)({ summary: 'Add Seller Qualification', operationId: 'maAddSellerQualification' }),
    (0, swagger_1.ApiParam)({ name: 'id', required: true }),
    (0, swagger_1.ApiCreatedResponse)({ type: dto_1.SellerQualificationResponseDto }),
    openapi.ApiResponse({ status: 201, type: require("./dto").SellerQualificationResponseDto }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.CreateSellerQualificationDto]),
    __metadata("design:returntype", void 0)
], MaActorsController.prototype, "addSellerQualification", null);
__decorate([
    (0, common_1.Patch)(':id/seller-qualifications/:qualificationId'),
    (0, casbin_guard_1.CasbinAction)('write'),
    (0, swagger_1.ApiOperation)({ summary: 'Update Seller Qualification', operationId: 'maUpdateSellerQualification' }),
    (0, swagger_1.ApiParam)({ name: 'id', required: true }),
    (0, swagger_1.ApiParam)({ name: 'qualificationId', required: true }),
    (0, swagger_1.ApiOkResponse)({ type: dto_1.SellerQualificationResponseDto }),
    openapi.ApiResponse({ status: 200, type: require("./dto").SellerQualificationResponseDto }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('qualificationId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, dto_1.UpdateSellerQualificationDto]),
    __metadata("design:returntype", void 0)
], MaActorsController.prototype, "updateSellerQualification", null);
__decorate([
    (0, common_1.Get)(':id/buyer-qualifications'),
    (0, casbin_guard_1.CasbinAction)('read'),
    (0, swagger_1.ApiOperation)({ summary: 'Get Buyer Qualifications', operationId: 'maGetBuyerQualifications' }),
    (0, swagger_1.ApiParam)({ name: 'id', required: true }),
    (0, swagger_1.ApiOkResponse)({ type: [dto_1.BuyerQualificationResponseDto] }),
    openapi.ApiResponse({ status: 200, type: [require("./dto").BuyerQualificationResponseDto] }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MaActorsController.prototype, "getBuyerQualifications", null);
__decorate([
    (0, common_1.Post)(':id/buyer-qualifications'),
    (0, casbin_guard_1.CasbinAction)('write'),
    (0, swagger_1.ApiOperation)({ summary: 'Add Buyer Qualification', operationId: 'maAddBuyerQualification' }),
    (0, swagger_1.ApiParam)({ name: 'id', required: true }),
    (0, swagger_1.ApiCreatedResponse)({ type: dto_1.BuyerQualificationResponseDto }),
    openapi.ApiResponse({ status: 201, type: require("./dto").BuyerQualificationResponseDto }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.CreateBuyerQualificationDto]),
    __metadata("design:returntype", void 0)
], MaActorsController.prototype, "addBuyerQualification", null);
__decorate([
    (0, common_1.Patch)(':id/buyer-qualifications/:qualificationId'),
    (0, casbin_guard_1.CasbinAction)('write'),
    (0, swagger_1.ApiOperation)({ summary: 'Update Buyer Qualification', operationId: 'maUpdateBuyerQualification' }),
    (0, swagger_1.ApiParam)({ name: 'id', required: true }),
    (0, swagger_1.ApiParam)({ name: 'qualificationId', required: true }),
    (0, swagger_1.ApiOkResponse)({ type: dto_1.BuyerQualificationResponseDto }),
    openapi.ApiResponse({ status: 200, type: require("./dto").BuyerQualificationResponseDto }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('qualificationId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, dto_1.UpdateBuyerQualificationDto]),
    __metadata("design:returntype", void 0)
], MaActorsController.prototype, "updateBuyerQualification", null);
__decorate([
    (0, common_1.Get)(':id/strategic-intelligence'),
    (0, casbin_guard_1.CasbinAction)('read'),
    (0, swagger_1.ApiOperation)({ summary: 'Get Strategic Intelligence', operationId: 'maGetStrategicIntelligence' }),
    (0, swagger_1.ApiParam)({ name: 'id', required: true }),
    (0, swagger_1.ApiOkResponse)({ type: [dto_1.StrategicIntelligenceResponseDto] }),
    openapi.ApiResponse({ status: 200, type: [require("./dto").StrategicIntelligenceResponseDto] }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MaActorsController.prototype, "getStrategicIntelligence", null);
__decorate([
    (0, common_1.Post)(':id/strategic-intelligence'),
    (0, casbin_guard_1.CasbinAction)('write'),
    (0, swagger_1.ApiOperation)({ summary: 'Add Strategic Intelligence', operationId: 'maAddStrategicIntelligence' }),
    (0, swagger_1.ApiParam)({ name: 'id', required: true }),
    (0, swagger_1.ApiCreatedResponse)({ type: dto_1.StrategicIntelligenceResponseDto }),
    openapi.ApiResponse({ status: 201, type: require("./dto").StrategicIntelligenceResponseDto }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.CreateStrategicIntelligenceDto]),
    __metadata("design:returntype", void 0)
], MaActorsController.prototype, "addStrategicIntelligence", null);
__decorate([
    (0, common_1.Patch)(':id/strategic-intelligence/:intelligenceId'),
    (0, casbin_guard_1.CasbinAction)('write'),
    (0, swagger_1.ApiOperation)({ summary: 'Update Strategic Intelligence', operationId: 'maUpdateStrategicIntelligence' }),
    (0, swagger_1.ApiParam)({ name: 'id', required: true }),
    (0, swagger_1.ApiParam)({ name: 'intelligenceId', required: true }),
    (0, swagger_1.ApiOkResponse)({ type: dto_1.StrategicIntelligenceResponseDto }),
    openapi.ApiResponse({ status: 200, type: require("./dto").StrategicIntelligenceResponseDto }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('intelligenceId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, dto_1.UpdateStrategicIntelligenceDto]),
    __metadata("design:returntype", void 0)
], MaActorsController.prototype, "updateStrategicIntelligence", null);
exports.MaActorsController = MaActorsController = __decorate([
    (0, swagger_1.ApiTags)('Actors'),
    (0, common_1.Controller)('actors'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)(['jwt', 'api-key']), casbin_guard_1.CasbinGuard),
    (0, casbin_guard_1.CasbinResource)(shared_1.SystemResource.CRM),
    __metadata("design:paramtypes", [ma_service_1.MaService])
], MaActorsController);
//# sourceMappingURL=ma.actors.controller.js.map