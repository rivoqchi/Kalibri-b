import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthedRequest } from '../auth/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard.js';
import { SearchService } from './search.service.js';
import {
  DeleteSearchHistoryQueryDto,
  RecordRecentProductDto,
  RecordSearchHistoryDto,
  SearchHistoryQueryDto,
  SearchProductsQueryDto,
  SearchRecentProductsQueryDto,
  SearchSuggestQueryDto,
} from './dto/search.dto.js';

@Controller('api/search')
@UseGuards(OptionalJwtAuthGuard)
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get('products')
  searchProducts(@Query() query: SearchProductsQueryDto) {
    return this.searchService.searchProducts(query);
  }

  @Get('suggest')
  suggest(@Query() query: SearchSuggestQueryDto) {
    return this.searchService.suggest(query);
  }

  @Get('history')
  listHistory(
    @Req() req: AuthedRequest,
    @Headers('x-session-id') sessionId: string | undefined,
    @Query() query: SearchHistoryQueryDto,
  ) {
    return this.searchService.listHistory(req.user?.sub, sessionId, query);
  }

  @Post('history')
  recordHistory(
    @Req() req: AuthedRequest,
    @Headers('x-session-id') sessionId: string | undefined,
    @Body() dto: RecordSearchHistoryDto,
  ) {
    return this.searchService.recordHistory(req.user?.sub, sessionId, dto);
  }

  @Delete('history')
  deleteHistory(
    @Req() req: AuthedRequest,
    @Headers('x-session-id') sessionId: string | undefined,
    @Query() query: DeleteSearchHistoryQueryDto,
  ) {
    return this.searchService.deleteHistory(req.user?.sub, sessionId, query.q);
  }

  @Get('recent-products')
  listRecentProducts(
    @Req() req: AuthedRequest,
    @Headers('x-session-id') sessionId: string | undefined,
    @Query() query: SearchRecentProductsQueryDto,
  ) {
    return this.searchService.listRecentProducts(
      req.user?.sub,
      sessionId,
      query,
    );
  }

  @Post('recent-products')
  recordRecentProduct(
    @Req() req: AuthedRequest,
    @Headers('x-session-id') sessionId: string | undefined,
    @Body() dto: RecordRecentProductDto,
  ) {
    return this.searchService.recordRecentProduct(
      req.user?.sub,
      sessionId,
      dto,
    );
  }
}
