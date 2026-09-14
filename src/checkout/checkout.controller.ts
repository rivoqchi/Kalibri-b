import { Body, Controller, Headers, Post } from '@nestjs/common';
import { CheckoutService } from './checkout.service.js';
import { CreateCheckoutDto } from './dto/create-checkout.dto.js';

@Controller('api/checkout')
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  @Post()
  create(
    @Headers('x-session-id') sessionId: string,
    @Body() dto: CreateCheckoutDto,
  ) {
    return this.checkoutService.create(sessionId, dto);
  }
}
