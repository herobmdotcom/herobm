import {
  Controller,
  Get,
  Query,
  Param,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ApiTags, ApiOperation, ApiOkResponse } from '@nestjs/swagger';
import { SkipCasbin } from '../auth/casbin.guard';
import { AuthUser, type JwtUser } from '../auth/auth-user.decorator';
import { HelpService } from './help.service';
import {
  HelpContextQueryDto,
  HelpSearchQueryDto,
  HelpContextResponseDto,
  HelpTopicSummaryDto,
  HelpTopicDto,
  HelpSearchResultDto,
} from './dto';
import {
  HelpContextResponse,
  HelpTopicSummary,
  HelpTopic,
  HelpSearchResult,
} from './help.types';

@Controller('help')
@SkipCasbin()
@UseGuards(ThrottlerGuard)
@ApiTags('Help')
export class HelpController {
  constructor(private readonly helpService: HelpService) {}

  @Get('context')
  @SkipCasbin()
  @ApiOkResponse({ type: HelpContextResponseDto })
  @ApiOperation({
    summary: 'Get contextual help for the active screen route',
    description:
      'Resolves the most relevant help topic and field guide for a route.',
  })
  async getContext(
    @Query() query: HelpContextQueryDto,
    @AuthUser() user: JwtUser,
  ): Promise<HelpContextResponse> {
    return this.helpService.getContextHelp(query.route, user?.role);
  }

  @Get('topics')
  @SkipCasbin()
  @ApiOkResponse({ type: [HelpTopicSummaryDto] })
  @ApiOperation({
    summary: 'Get all accessible documentation topics',
    description: 'Returns the categorized table of contents for user manuals.',
  })
  async getTopics(@AuthUser() user: JwtUser): Promise<HelpTopicSummary[]> {
    return this.helpService.getTopics(user?.role);
  }

  @Get('topics/:id')
  @SkipCasbin()
  @ApiOkResponse({ type: HelpTopicDto })
  @ApiOperation({
    summary: 'Get full topic content by ID',
    description:
      'Returns the full markdown content and metadata for a specific topic.',
  })
  async getTopicById(
    @Param('id') id: string,
    @AuthUser() user: JwtUser,
  ): Promise<HelpTopic> {
    const topic = await this.helpService.getTopicById(id, user?.role);
    if (!topic) {
      throw new NotFoundException(`Help topic '${id}' not found`);
    }
    return topic;
  }

  @Get('search')
  @SkipCasbin()
  @ApiOkResponse({ type: [HelpSearchResultDto] })
  @ApiOperation({
    summary: 'Search documentation topics',
    description:
      'Searches titles, tags, field definitions, and markdown content.',
  })
  async search(
    @Query() query: HelpSearchQueryDto,
    @AuthUser() user: JwtUser,
  ): Promise<HelpSearchResult[]> {
    return this.helpService.search(query.q, user?.role);
  }
}
