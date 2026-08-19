import { Controller, Get, Query } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiQuery,
  ApiOkResponse,
} from '@nestjs/swagger';
import { GlobalNotesService } from './global-notes.service';
import { GlobalNotesListResponseDto } from './dto';
import { CasbinResource, CasbinAction } from '../auth/casbin.guard';
import { PaginationQuery } from '../common/pagination';
import { SystemResource } from '@herobm/shared';

@Controller('global-notes')
@CasbinResource(SystemResource.SALES_CREDIT_NOTES) // Adjust if necessary, as both are needed, but we'll re-use this resource for simplicity
@ApiTags('Global Notes')
export class GlobalNotesController {
  constructor(private readonly globalNotesService: GlobalNotesService) {}

  @Get()
  @ApiOkResponse({ type: GlobalNotesListResponseDto })
  @CasbinAction('read')
  @ApiOperation({
    summary: 'Find All Global Notes',
    description:
      'Retrieve a unified paginated list of sales credit notes and purchase debit notes.',
  })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'q', required: false })
  findAll(@Query() query: PaginationQuery) {
    return this.globalNotesService.findAll(query);
  }
}
