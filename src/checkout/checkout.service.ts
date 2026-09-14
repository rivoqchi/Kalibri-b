import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cart, CartDocument } from '../cart/cart.schema.js';
import { CreateCheckoutDto } from './dto/create-checkout.dto.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import { randomUUID } from 'node:crypto';

@Injectable()
export class CheckoutService {
  constructor(
    @InjectModel(Cart.name) private readonly cartModel: Model<CartDocument>,
    private readonly realtime: RealtimeGateway,
  ) {}

  async create(sessionId: string, dto: CreateCheckoutDto) {
    if (!sessionId) throw new BadRequestException('x-session-id header required');

    const cart = await this.cartModel.findOne({ sessionId }).exec();
    if (!cart || cart.items.length === 0) {
      throw new BadRequestException('Cart is empty');
    }

    const currency = cart.items[0]?.unitPrice.currency ?? 'UZS';
    const totalAmount = cart.items.reduce(
      (sum, item) => sum + item.unitPrice.amount * item.quantity,
      0,
    );

    const order = {
      id: randomUUID(),
      status: 'pending' as const,
      customer: dto,
      items: cart.items,
      total: { amount: totalAmount, currency },
      createdAt: new Date().toISOString(),
    };

    cart.items = [];
    await cart.save();

    this.realtime.emitCartUpdated(sessionId, {
      sessionId,
      items: [],
      subtotal: { amount: 0, currency },
    });
    this.realtime.emitOrderCreated(sessionId, order);

    return order;
  }
}
