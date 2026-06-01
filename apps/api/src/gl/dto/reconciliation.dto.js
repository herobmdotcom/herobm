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
exports.CreateAdjustmentResponseDto = exports.DiscardReconciliationResponseDto = exports.PostReconciliationResponseDto = exports.ToggleLineResponseDto = exports.UnreconciledLinesResponseDto = exports.ReconciliationDetailResponseDto = exports.CreateReconciliationResponseDto = exports.ReconciliationListResponseDto = exports.CreateAdjustmentDto = exports.ToggleLineDto = exports.CreateReconciliationDto = void 0;
var class_validator_1 = require("class-validator");
var CreateReconciliationDto = /** @class */ (function () {
    function CreateReconciliationDto() {
    }
    __decorate([
        (0, class_validator_1.IsString)(),
        (0, class_validator_1.IsNotEmpty)(),
        __metadata("design:type", String)
    ], CreateReconciliationDto.prototype, "glAccountId", void 0);
    __decorate([
        (0, class_validator_1.IsDateString)(),
        (0, class_validator_1.IsNotEmpty)(),
        __metadata("design:type", String)
    ], CreateReconciliationDto.prototype, "statementDate", void 0);
    __decorate([
        (0, class_validator_1.IsNumber)(),
        (0, class_validator_1.IsNotEmpty)(),
        __metadata("design:type", Number)
    ], CreateReconciliationDto.prototype, "statementBalance", void 0);
    __decorate([
        (0, class_validator_1.IsString)(),
        (0, class_validator_1.IsOptional)(),
        __metadata("design:type", String)
    ], CreateReconciliationDto.prototype, "createdBy", void 0);
    return CreateReconciliationDto;
}());
exports.CreateReconciliationDto = CreateReconciliationDto;
var ToggleLineDto = /** @class */ (function () {
    function ToggleLineDto() {
    }
    __decorate([
        (0, class_validator_1.IsBoolean)(),
        __metadata("design:type", Boolean)
    ], ToggleLineDto.prototype, "isCleared", void 0);
    __decorate([
        (0, class_validator_1.IsNumber)(),
        (0, class_validator_1.IsOptional)(),
        __metadata("design:type", Number)
    ], ToggleLineDto.prototype, "amount", void 0);
    return ToggleLineDto;
}());
exports.ToggleLineDto = ToggleLineDto;
var CreateAdjustmentDto = /** @class */ (function () {
    function CreateAdjustmentDto() {
    }
    __decorate([
        (0, class_validator_1.IsDateString)(),
        (0, class_validator_1.IsNotEmpty)(),
        __metadata("design:type", String)
    ], CreateAdjustmentDto.prototype, "date", void 0);
    __decorate([
        (0, class_validator_1.IsNumber)(),
        (0, class_validator_1.IsNotEmpty)(),
        __metadata("design:type", Number)
    ], CreateAdjustmentDto.prototype, "amount", void 0);
    __decorate([
        (0, class_validator_1.IsEnum)(['debit', 'credit']),
        (0, class_validator_1.IsNotEmpty)(),
        __metadata("design:type", String)
    ], CreateAdjustmentDto.prototype, "type", void 0);
    __decorate([
        (0, class_validator_1.IsString)(),
        (0, class_validator_1.IsNotEmpty)(),
        __metadata("design:type", String)
    ], CreateAdjustmentDto.prototype, "offsetAccountId", void 0);
    __decorate([
        (0, class_validator_1.IsString)(),
        (0, class_validator_1.IsNotEmpty)(),
        __metadata("design:type", String)
    ], CreateAdjustmentDto.prototype, "memo", void 0);
    return CreateAdjustmentDto;
}());
exports.CreateAdjustmentDto = CreateAdjustmentDto;
var ReconciliationListResponseDto = /** @class */ (function () {
    function ReconciliationListResponseDto() {
    }
    return ReconciliationListResponseDto;
}());
exports.ReconciliationListResponseDto = ReconciliationListResponseDto;
var CreateReconciliationResponseDto = /** @class */ (function () {
    function CreateReconciliationResponseDto() {
    }
    return CreateReconciliationResponseDto;
}());
exports.CreateReconciliationResponseDto = CreateReconciliationResponseDto;
var ReconciliationDetailResponseDto = /** @class */ (function () {
    function ReconciliationDetailResponseDto() {
    }
    return ReconciliationDetailResponseDto;
}());
exports.ReconciliationDetailResponseDto = ReconciliationDetailResponseDto;
var UnreconciledLinesResponseDto = /** @class */ (function () {
    function UnreconciledLinesResponseDto() {
    }
    return UnreconciledLinesResponseDto;
}());
exports.UnreconciledLinesResponseDto = UnreconciledLinesResponseDto;
var ToggleLineResponseDto = /** @class */ (function () {
    function ToggleLineResponseDto() {
    }
    return ToggleLineResponseDto;
}());
exports.ToggleLineResponseDto = ToggleLineResponseDto;
var PostReconciliationResponseDto = /** @class */ (function () {
    function PostReconciliationResponseDto() {
    }
    return PostReconciliationResponseDto;
}());
exports.PostReconciliationResponseDto = PostReconciliationResponseDto;
var DiscardReconciliationResponseDto = /** @class */ (function () {
    function DiscardReconciliationResponseDto() {
    }
    return DiscardReconciliationResponseDto;
}());
exports.DiscardReconciliationResponseDto = DiscardReconciliationResponseDto;
var CreateAdjustmentResponseDto = /** @class */ (function () {
    function CreateAdjustmentResponseDto() {
    }
    return CreateAdjustmentResponseDto;
}());
exports.CreateAdjustmentResponseDto = CreateAdjustmentResponseDto;
