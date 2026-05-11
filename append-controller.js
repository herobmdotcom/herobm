const fs = require('fs');

let content = fs.readFileSync('apps/api/src/orders/transfers/transfers.controller.ts', 'utf8');

content = content.replace(
  /import \{([\s\S]*?)Req,(\s*)\} from '@nestjs\/common';/,
  "import {$1Req, Patch, Query$2} from '@nestjs/common';"
);

content = content.replace(
  /import \{ TransferService \} from '\.\/transfers\.service';/,
  "import { TransferService } from './transfers.service';\nimport { PaginationQuery } from '../../common/pagination';\nimport { CreateTransferOrderDto, UpdateTransferOrderDto, CreateTransferOrderLineDto, UpdateTransferOrderLineDto } from './dto';"
);

let code = `
  @Get()
  @CasbinAction('read')
  async findAll(@Query() query: PaginationQuery) {
    return this.transferService.findAll(query);
  }

  @Get(':id')
  @CasbinAction('read')
  async findOne(@Param('id') id: string) {
    return this.transferService.findOne(id);
  }

  @Post()
  @CasbinAction('write')
  async create(@Body() body: CreateTransferOrderDto, @Req() req: any) {
    return this.transferService.create(body, req.user?.sub || 'system');
  }

  @Patch(':id')
  @CasbinAction('write')
  async update(
    @Param('id') id: string,
    @Body() body: UpdateTransferOrderDto,
    @Req() req: any,
  ) {
    return this.transferService.update(id, body, req.user?.sub || 'system');
  }

  @Post(':id/lines')
  @CasbinAction('write')
  async addLine(
    @Param('id') id: string,
    @Body() body: CreateTransferOrderLineDto,
    @Req() req: any,
  ) {
    return this.transferService.addLine(id, body, req.user?.sub || 'system');
  }

  @Patch(':id/lines/:lineId')
  @CasbinAction('write')
  async updateLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Body() body: UpdateTransferOrderLineDto,
    @Req() req: any,
  ) {
    return this.transferService.updateLine(id, lineId, body, req.user?.sub || 'system');
  }

  @Delete(':id/lines/:lineId')
  @CasbinAction('write')
  async removeLine(
    @Param('id') id: string,
    @Param('lineId') lineId: string,
    @Req() req: any,
  ) {
    return this.transferService.removeLine(id, lineId, req.user?.sub || 'system');
  }
}
`;

content = content.replace(/}\s*$/, code);
fs.writeFileSync('apps/api/src/orders/transfers/transfers.controller.ts', content);
console.log('Appended CRUD to transfers.controller.ts');
