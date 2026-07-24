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
exports.MaController = void 0;
const openapi = require("@nestjs/swagger");
const common_1 = require("@nestjs/common");
const passport_1 = require("@nestjs/passport");
const swagger_1 = require("@nestjs/swagger");
const ma_service_1 = require("./ma.service");
const dto_1 = require("./dto");
const shared_1 = require("@herobm/shared");
const casbin_guard_1 = require("../../../../apps/api/src/auth/casbin.guard");
let MaController = class MaController {
    maService;
    constructor(maService) {
        this.maService = maService;
    }
    getFeedback(id) {
        return this.maService.getFeedback(id);
    }
    addFeedback(id, dto) {
        return this.maService.addFeedback(id, dto);
    }
    updateFeedback(id, feedbackId, dto) {
        return this.maService.updateFeedback(id, feedbackId, dto);
    }
};
exports.MaController = MaController;
__decorate([
    (0, common_1.Get)(':id/feedback'),
    (0, casbin_guard_1.CasbinAction)('read'),
    (0, swagger_1.ApiOperation)({ summary: 'Get Project Feedback', operationId: 'maController_getFeedback' }),
    (0, swagger_1.ApiParam)({ name: 'id', required: true }),
    (0, swagger_1.ApiOkResponse)({ type: [dto_1.ProjectFeedbackResponseDto] }),
    openapi.ApiResponse({ status: 200, type: [require("./dto").ProjectFeedbackResponseDto] }),
    __param(0, (0, common_1.Param)('id')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String]),
    __metadata("design:returntype", void 0)
], MaController.prototype, "getFeedback", null);
__decorate([
    (0, common_1.Post)(':id/feedback'),
    (0, casbin_guard_1.CasbinAction)('write'),
    (0, swagger_1.ApiOperation)({ summary: 'Add Project Feedback', operationId: 'maController_addFeedback' }),
    (0, swagger_1.ApiParam)({ name: 'id', required: true }),
    (0, swagger_1.ApiCreatedResponse)({ type: dto_1.ProjectFeedbackResponseDto }),
    openapi.ApiResponse({ status: 201, type: require("./dto").ProjectFeedbackResponseDto }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, dto_1.CreateProjectFeedbackDto]),
    __metadata("design:returntype", void 0)
], MaController.prototype, "addFeedback", null);
__decorate([
    (0, common_1.Patch)(':id/feedback/:feedbackId'),
    (0, casbin_guard_1.CasbinAction)('write'),
    (0, swagger_1.ApiOperation)({ summary: 'Update Project Feedback', operationId: 'maController_updateFeedback' }),
    (0, swagger_1.ApiParam)({ name: 'id', required: true }),
    (0, swagger_1.ApiParam)({ name: 'feedbackId', required: true }),
    (0, swagger_1.ApiOkResponse)({ type: dto_1.ProjectFeedbackResponseDto }),
    openapi.ApiResponse({ status: 200, type: require("./dto").ProjectFeedbackResponseDto }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Param)('feedbackId')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, String, dto_1.UpdateProjectFeedbackDto]),
    __metadata("design:returntype", void 0)
], MaController.prototype, "updateFeedback", null);
exports.MaController = MaController = __decorate([
    (0, swagger_1.ApiTags)('Projects'),
    (0, common_1.Controller)('projects'),
    (0, common_1.UseGuards)((0, passport_1.AuthGuard)(['jwt', 'api-key']), casbin_guard_1.CasbinGuard),
    (0, casbin_guard_1.CasbinResource)(shared_1.SystemResource.CRM),
    __metadata("design:paramtypes", [ma_service_1.MaService])
], MaController);
//# sourceMappingURL=ma.controller.js.map