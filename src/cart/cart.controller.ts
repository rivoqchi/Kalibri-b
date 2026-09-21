import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { AuthedRequest } from '../auth/jwt-auth.guard.js';
import { OptionalJwtAuthGuard } from '../auth/optional-jwt-auth.guard.js';
import { CartService } from './cart.service.js';
import { AddCartItemDto } from './dto/add-cart-item.dto.js';
import { UpdateCartItemDto } from './dto/update-cart-item.dto.js';

@Controller('api/cart')
@UseGuards(OptionalJwtAuthGuard)
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  get(
    @Req() req: AuthedRequest,
    @Headers('x-session-id') sessionId: string | undefined,
  ) {
    return this.cartService.getCart(req.user?.sub, sessionId);
  }

  @Post('items')
  addItem(
    @Req() req: AuthedRequest,
    @Headers('x-session-id') sessionId: string | undefined,
    @Body() dto: AddCartItemDto,
  ) {
    return this.cartService.addItem(req.user?.sub, sessionId, dto);
  }

  @Patch('items/:productId')
  setItemQuantity(
    @Req() req: AuthedRequest,
    @Headers('x-session-id') sessionId: string | undefined,
    @Param('productId') productId: string,
    @Body() dto: UpdateCartItemDto,
  ) {
    return this.cartService.setItemQuantity(
      req.user?.sub,
      sessionId,
      productId,
      dto,
    );
  }

  @Delete('items/:productId')
  removeItem(
    @Req() req: AuthedRequest,
    @Headers('x-session-id') sessionId: string | undefined,
    @Param('productId') productId: string,
  ) {
    return this.cartService.removeItem(req.user?.sub, sessionId, productId);
  }

  @Delete()
  clear(
    @Req() req: AuthedRequest,
    @Headers('x-session-id') sessionId: string | undefined,
  ) {
    return this.cartService.clearCart(req.user?.sub, sessionId);
  }
}
