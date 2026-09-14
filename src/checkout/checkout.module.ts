import { Module, forwardRef } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Cart, CartSchema } from '../cart/cart.schema.js';
import { CheckoutService } from './checkout.service.js';
import { CheckoutController } from './checkout.controller.js';
import { RealtimeModule } from '../realtime/realtime.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Cart.name, schema: CartSchema }]),
    forwardRef(() => RealtimeModule),
  ],
  controllers: [CheckoutController],
  providers: [CheckoutService],
})
export class CheckoutModule {}
