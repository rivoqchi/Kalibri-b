import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthedRequest } from '../auth/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard.js';
import { FavoritesService } from './favorites.service.js';
import { AddFavoriteItemDto } from './dto/add-favorite-item.dto.js';
import { ReplaceFavoritesDto } from './dto/replace-favorites.dto.js';

@Controller('api/favorites')
@UseGuards(OptionalJwtAuthGuard)
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  get(
    @Req() req: AuthedRequest,
    @Headers('x-session-id') sessionId: string | undefined,
  ) {
    return this.favoritesService.getFavorites(req.user?.sub, sessionId);
  }

  @Post('items')
  addItem(
    @Req() req: AuthedRequest,
    @Headers('x-session-id') sessionId: string | undefined,
    @Body() dto: AddFavoriteItemDto,
  ) {
    return this.favoritesService.addItem(req.user?.sub, sessionId, dto);
  }

  @Delete('items/:productId')
  removeItem(
    @Req() req: AuthedRequest,
    @Headers('x-session-id') sessionId: string | undefined,
    @Param('productId') productId: string,
  ) {
    return this.favoritesService.removeItem(
      req.user?.sub,
      sessionId,
      productId,
    );
  }

  @Put()
  replaceAll(
    @Req() req: AuthedRequest,
    @Headers('x-session-id') sessionId: string | undefined,
    @Body() dto: ReplaceFavoritesDto,
  ) {
    return this.favoritesService.replaceAll(req.user?.sub, sessionId, dto);
  }
}
