"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MaExtensionModule = void 0;
const common_1 = require("@nestjs/common");
const ma_controller_1 = require("./ma.controller");
const ma_actors_controller_1 = require("./ma.actors.controller");
const ma_service_1 = require("./ma.service");
let MaExtensionModule = class MaExtensionModule {
};
exports.MaExtensionModule = MaExtensionModule;
exports.MaExtensionModule = MaExtensionModule = __decorate([
    (0, common_1.Module)({
        controllers: [ma_controller_1.MaController, ma_actors_controller_1.MaActorsController],
        providers: [ma_service_1.MaService],
    })
], MaExtensionModule);
//# sourceMappingURL=ma.module.js.map