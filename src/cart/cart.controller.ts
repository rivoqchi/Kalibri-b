import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { CartService } from './cart.service.js';
import { AddCartItemDto } from './dto/add-cart-item.dto.js';

@Controller('api/cart')
export class CartController {
  constructor(private readonly cartService: CartService) {}

  @Get()
  get(@Headers('x-session-id') sessionId: string) {
    return this.cartService.getCart(sessionId);
  }

  @Post('items')
  addItem(
    @Headers('x-session-id') sessionId: string,
    @Body() dto: AddCartItemDto,
  ) {
    return this.cartService.addItem(sessionId, dto);
  }
}
