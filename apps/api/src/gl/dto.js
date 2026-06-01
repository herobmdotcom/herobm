"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateGLSettingsDto = exports.PaginatedGeneralLedgerDto = exports.PaginatedJournalEntriesDto = exports.EmptyBodyDto = exports.SeedRequestDto = exports.SeedTaxRequestDto = exports.UpdateAccountRequestDto = exports.CreateAccountRequestDto = exports.ArrayResponseDto = exports.SuccessMessageResponseDto = exports.SettingsResponseDto = exports.GeneralLedgerResponseDto = exports.TrialBalanceResponseDto = exports.JournalEntryResponseDto = exports.GlAccountResponseDto = exports.CreateJournalEntryDto = exports.JournalLineDto = void 0;
var swagger_1 = require("@nestjs/swagger");
var class_validator_1 = require("class-validator");
__exportStar(require("./dto/reconciliation.dto"), exports);
var JournalLineDto = /** @class */ (function () {
    function JournalLineDto() {
    }
    __decorate([
        (0, class_validator_1.IsOptional)(),
        (0, class_validator_1.IsString)(),
        __metadata("design:type", String)
    ], JournalLineDto.prototype, "accountCode", void 0);
    __decorate([
        (0, class_validator_1.IsOptional)(),
        (0, class_validator_1.IsString)(),
        __metadata("design:type", String)
    ], JournalLineDto.prototype, "accountId", void 0);
    __decorate([
        (0, class_validator_1.IsOptional)(),
        (0, class_validator_1.IsString)(),
        __metadata("design:type", String)
    ], JournalLineDto.prototype, "costCenterId", void 0);
    __decorate([
        (0, class_validator_1.IsOptional)(),
        (0, class_validator_1.IsString)(),
        __metadata("design:type", String)
    ], JournalLineDto.prototype, "activityId", void 0);
    __decorate([
        (0, class_validator_1.IsOptional)(),
        (0, class_validator_1.IsEnum)(['customer', 'supplier']),
        __metadata("design:type", String)
    ], JournalLineDto.prototype, "partyType", void 0);
    __decorate([
        (0, class_validator_1.IsOptional)(),
        (0, class_validator_1.IsString)(),
        __metadata("design:type", String)
    ], JournalLineDto.prototype, "partyId", void 0);
    __decorate([
        (0, class_validator_1.IsNumber)(),
        __metadata("design:type", Number)
    ], JournalLineDto.prototype, "debit", void 0);
    __decorate([
        (0, class_validator_1.IsNumber)(),
        __metadata("design:type", Number)
    ], JournalLineDto.prototype, "credit", void 0);
    __decorate([
        (0, class_validator_1.IsOptional)(),
        (0, class_validator_1.IsString)(),
        __metadata("design:type", String)
    ], JournalLineDto.prototype, "memo", void 0);
    return JournalLineDto;
}());
exports.JournalLineDto = JournalLineDto;
var class_transformer_1 = require("class-transformer");
var class_validator_2 = require("class-validator");
var CreateJournalEntryDto = /** @class */ (function () {
    function CreateJournalEntryDto() {
    }
    __decorate([
        (0, swagger_1.ApiPropertyOptional)(),
        (0, class_validator_2.IsUUID)(),
        (0, class_validator_1.IsOptional)(),
        __metadata("design:type", String)
    ], CreateJournalEntryDto.prototype, "journalEntryId", void 0);
    __decorate([
        (0, class_validator_2.IsArray)(),
        (0, class_validator_2.ValidateNested)({ each: true }),
        (0, class_transformer_1.Type)(function () { return JournalLineDto; }),
        __metadata("design:type", Array)
    ], CreateJournalEntryDto.prototype, "lines", void 0);
    __decorate([
        (0, class_validator_1.IsOptional)(),
        (0, class_validator_1.IsString)(),
        __metadata("design:type", String)
    ], CreateJournalEntryDto.prototype, "memo", void 0);
    __decorate([
        (0, class_validator_1.IsOptional)(),
        (0, class_validator_1.IsString)(),
        __metadata("design:type", String)
    ], CreateJournalEntryDto.prototype, "entryDate", void 0);
    __decorate([
        (0, class_validator_1.IsOptional)(),
        (0, class_validator_1.IsString)(),
        __metadata("design:type", String)
    ], CreateJournalEntryDto.prototype, "actor", void 0);
    return CreateJournalEntryDto;
}());
exports.CreateJournalEntryDto = CreateJournalEntryDto;
var GlAccountResponseDto = /** @class */ (function () {
    function GlAccountResponseDto() {
    }
    return GlAccountResponseDto;
}());
exports.GlAccountResponseDto = GlAccountResponseDto;
var JournalEntryResponseDto = /** @class */ (function () {
    function JournalEntryResponseDto() {
    }
    return JournalEntryResponseDto;
}());
exports.JournalEntryResponseDto = JournalEntryResponseDto;
var TrialBalanceResponseDto = /** @class */ (function () {
    function TrialBalanceResponseDto() {
    }
    return TrialBalanceResponseDto;
}());
exports.TrialBalanceResponseDto = TrialBalanceResponseDto;
var GeneralLedgerResponseDto = /** @class */ (function () {
    function GeneralLedgerResponseDto() {
    }
    return GeneralLedgerResponseDto;
}());
exports.GeneralLedgerResponseDto = GeneralLedgerResponseDto;
var SettingsResponseDto = /** @class */ (function () {
    function SettingsResponseDto() {
    }
    return SettingsResponseDto;
}());
exports.SettingsResponseDto = SettingsResponseDto;
var SuccessMessageResponseDto = /** @class */ (function () {
    function SuccessMessageResponseDto() {
    }
    return SuccessMessageResponseDto;
}());
exports.SuccessMessageResponseDto = SuccessMessageResponseDto;
var ArrayResponseDto = /** @class */ (function () {
    function ArrayResponseDto() {
    }
    return ArrayResponseDto;
}());
exports.ArrayResponseDto = ArrayResponseDto;
var CreateAccountRequestDto = /** @class */ (function () {
    function CreateAccountRequestDto() {
    }
    __decorate([
        (0, class_validator_1.IsString)(),
        (0, class_validator_1.IsNotEmpty)(),
        __metadata("design:type", String)
    ], CreateAccountRequestDto.prototype, "accountCode", void 0);
    __decorate([
        (0, class_validator_1.IsString)(),
        (0, class_validator_1.IsNotEmpty)(),
        __metadata("design:type", String)
    ], CreateAccountRequestDto.prototype, "name", void 0);
    __decorate([
        (0, class_validator_1.IsString)(),
        (0, class_validator_1.IsNotEmpty)(),
        __metadata("design:type", String)
    ], CreateAccountRequestDto.prototype, "accountType", void 0);
    __decorate([
        (0, class_validator_1.IsString)(),
        (0, class_validator_1.IsOptional)(),
        __metadata("design:type", String)
    ], CreateAccountRequestDto.prototype, "parentAccountId", void 0);
    __decorate([
        (0, class_validator_1.IsBoolean)(),
        (0, class_validator_1.IsOptional)(),
        __metadata("design:type", Boolean)
    ], CreateAccountRequestDto.prototype, "isGroup", void 0);
    __decorate([
        (0, class_validator_1.IsBoolean)(),
        (0, class_validator_1.IsOptional)(),
        __metadata("design:type", Boolean)
    ], CreateAccountRequestDto.prototype, "isBankAccount", void 0);
    __decorate([
        (0, class_validator_1.IsString)(),
        (0, class_validator_1.IsOptional)(),
        __metadata("design:type", String)
    ], CreateAccountRequestDto.prototype, "currencyCode", void 0);
    __decorate([
        (0, class_validator_1.IsObject)(),
        (0, class_validator_1.IsOptional)(),
        __metadata("design:type", Object)
    ], CreateAccountRequestDto.prototype, "metadata", void 0);
    return CreateAccountRequestDto;
}());
exports.CreateAccountRequestDto = CreateAccountRequestDto;
var UpdateAccountRequestDto = /** @class */ (function () {
    function UpdateAccountRequestDto() {
    }
    __decorate([
        (0, class_validator_1.IsString)(),
        (0, class_validator_1.IsOptional)(),
        __metadata("design:type", String)
    ], UpdateAccountRequestDto.prototype, "name", void 0);
    __decorate([
        (0, class_validator_1.IsBoolean)(),
        (0, class_validator_1.IsOptional)(),
        __metadata("design:type", Boolean)
    ], UpdateAccountRequestDto.prototype, "isActive", void 0);
    __decorate([
        (0, class_validator_1.IsBoolean)(),
        (0, class_validator_1.IsOptional)(),
        __metadata("design:type", Boolean)
    ], UpdateAccountRequestDto.prototype, "isBankAccount", void 0);
    __decorate([
        (0, class_validator_1.IsObject)(),
        (0, class_validator_1.IsOptional)(),
        __metadata("design:type", Object)
    ], UpdateAccountRequestDto.prototype, "metadata", void 0);
    return UpdateAccountRequestDto;
}());
exports.UpdateAccountRequestDto = UpdateAccountRequestDto;
var SeedTaxRequestDto = /** @class */ (function () {
    function SeedTaxRequestDto() {
    }
    __decorate([
        (0, class_validator_1.IsString)(),
        (0, class_validator_1.IsNotEmpty)(),
        __metadata("design:type", String)
    ], SeedTaxRequestDto.prototype, "filename", void 0);
    return SeedTaxRequestDto;
}());
exports.SeedTaxRequestDto = SeedTaxRequestDto;
var SeedRequestDto = /** @class */ (function () {
    function SeedRequestDto() {
    }
    __decorate([
        (0, class_validator_1.IsString)(),
        (0, class_validator_1.IsOptional)(),
        __metadata("design:type", String)
    ], SeedRequestDto.prototype, "filename", void 0);
    return SeedRequestDto;
}());
exports.SeedRequestDto = SeedRequestDto;
var EmptyBodyDto = /** @class */ (function () {
    function EmptyBodyDto() {
    }
    return EmptyBodyDto;
}());
exports.EmptyBodyDto = EmptyBodyDto;
var PaginatedJournalEntriesDto = /** @class */ (function () {
    function PaginatedJournalEntriesDto() {
    }
    return PaginatedJournalEntriesDto;
}());
exports.PaginatedJournalEntriesDto = PaginatedJournalEntriesDto;
var PaginatedGeneralLedgerDto = /** @class */ (function () {
    function PaginatedGeneralLedgerDto() {
    }
    return PaginatedGeneralLedgerDto;
}());
exports.PaginatedGeneralLedgerDto = PaginatedGeneralLedgerDto;
var UpdateGLSettingsDto = /** @class */ (function () {
    function UpdateGLSettingsDto() {
    }
    __decorate([
        (0, class_validator_1.IsOptional)(),
        (0, class_validator_1.IsObject)(),
        __metadata("design:type", Object)
    ], UpdateGLSettingsDto.prototype, "accountMetadataSchema", void 0);
    __decorate([
        (0, class_validator_1.IsOptional)(),
        (0, class_validator_1.IsNumber)(),
        __metadata("design:type", Number)
    ], UpdateGLSettingsDto.prototype, "fiscalYearStartMonth", void 0);
    __decorate([
        (0, class_validator_1.IsOptional)(),
        (0, class_validator_1.IsString)(),
        __metadata("design:type", String)
    ], UpdateGLSettingsDto.prototype, "defaultArAccountId", void 0);
    __decorate([
        (0, class_validator_1.IsOptional)(),
        (0, class_validator_1.IsString)(),
        __metadata("design:type", String)
    ], UpdateGLSettingsDto.prototype, "defaultApAccountId", void 0);
    __decorate([
        (0, class_validator_1.IsOptional)(),
        (0, class_validator_1.IsString)(),
        __metadata("design:type", String)
    ], UpdateGLSettingsDto.prototype, "defaultRevenueAccountId", void 0);
    __decorate([
        (0, class_validator_1.IsOptional)(),
        (0, class_validator_1.IsString)(),
        __metadata("design:type", String)
    ], UpdateGLSettingsDto.prototype, "defaultCogsAccountId", void 0);
    __decorate([
        (0, class_validator_1.IsOptional)(),
        (0, class_validator_1.IsString)(),
        __metadata("design:type", String)
    ], UpdateGLSettingsDto.prototype, "defaultTaxAccountId", void 0);
    __decorate([
        (0, class_validator_1.IsOptional)(),
        (0, class_validator_1.IsString)(),
        __metadata("design:type", String)
    ], UpdateGLSettingsDto.prototype, "defaultExpenseAccountId", void 0);
    __decorate([
        (0, class_validator_1.IsOptional)(),
        (0, class_validator_1.IsString)(),
        __metadata("design:type", String)
    ], UpdateGLSettingsDto.prototype, "defaultInventoryAccountId", void 0);
    __decorate([
        (0, class_validator_1.IsOptional)(),
        (0, class_validator_1.IsString)(),
        __metadata("design:type", String)
    ], UpdateGLSettingsDto.prototype, "defaultGrniAccountId", void 0);
    __decorate([
        (0, class_validator_1.IsOptional)(),
        (0, class_validator_1.IsString)(),
        __metadata("design:type", String)
    ], UpdateGLSettingsDto.prototype, "defaultShrinkageAccountId", void 0);
    __decorate([
        (0, class_validator_1.IsOptional)(),
        (0, class_validator_1.IsString)(),
        __metadata("design:type", String)
    ], UpdateGLSettingsDto.prototype, "defaultFeeRevenueAccountId", void 0);
    __decorate([
        (0, class_validator_1.IsOptional)(),
        (0, class_validator_1.IsString)(),
        __metadata("design:type", String)
    ], UpdateGLSettingsDto.prototype, "baseCurrency", void 0);
    __decorate([
        (0, class_validator_1.IsOptional)(),
        (0, class_validator_2.IsArray)(),
        __metadata("design:type", Array)
    ], UpdateGLSettingsDto.prototype, "supportedBatchPaymentFormats", void 0);
    __decorate([
        (0, class_validator_1.IsOptional)(),
        (0, class_validator_1.IsString)(),
        __metadata("design:type", String)
    ], UpdateGLSettingsDto.prototype, "revenueRoutingPrecedence", void 0);
    __decorate([
        (0, class_validator_1.IsOptional)(),
        (0, class_validator_1.IsString)(),
        __metadata("design:type", String)
    ], UpdateGLSettingsDto.prototype, "expenseRoutingPrecedence", void 0);
    return UpdateGLSettingsDto;
}());
exports.UpdateGLSettingsDto = UpdateGLSettingsDto;
