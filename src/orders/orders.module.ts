import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Order, OrderSchema } from './order.schema.js';
import { OrdersService } from './orders.service.js';
import { OrdersController } from './orders.controller.js';
import { AuthModule } from '../auth/auth.module.js';
import { PartnersModule } from '../partners/partners.module.js';
import { NotificationsModule } from '../notifications/notifications.module.js';
import { RealtimeModule } from '../realtime/realtime.module.js';
import { CartModule } from '../cart/cart.module.js';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: Order.name, schema: OrderSchema }]),
    AuthModule,
    PartnersModule,
    NotificationsModule,
    RealtimeModule,
    CartModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}
