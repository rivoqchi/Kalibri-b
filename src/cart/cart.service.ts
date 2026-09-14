import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cart, CartDocument } from './cart.schema.js';
import { Product, ProductDocument } from '../products/product.schema.js';
import { AddCartItemDto } from './dto/add-cart-item.dto.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

@Injectable()
export class CartService {
  constructor(
    @InjectModel(Cart.name) private readonly cartModel: Model<CartDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    private readonly realtime: RealtimeGateway,
  ) {}

  private map(cart: CartDocument) {
    const items = cart.items.map((item) => ({
      productId: item.productId,
      slug: item.slug,
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      imageUrl: item.imageUrl,
    }));

    const currency = items[0]?.unitPrice.currency ?? 'UZS';
    const subtotalAmount = items.reduce(
      (sum, item) => sum + item.unitPrice.amount * item.quantity,
      0,
    );

    return {
      sessionId: cart.sessionId,
      items,
      subtotal: { amount: subtotalAmount, currency },
    };
  }

  private async getOrCreate(sessionId: string) {
    const existing = await this.cartModel.findOne({ sessionId }).exec();
    if (existing) return existing;
    return this.cartModel.create({ sessionId, items: [] });
  }

  async getCart(sessionId: string) {
    if (!sessionId) throw new BadRequestException('x-session-id header required');
    const cart = await this.getOrCreate(sessionId);
    return this.map(cart);
  }

  async addItem(sessionId: string, dto: AddCartItemDto) {
    if (!sessionId) throw new BadRequestException('x-session-id header required');

    const product = await this.productModel.findById(dto.productId).exec();
    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }
    if (!product.inStock) {
      throw new BadRequestException('Product out of stock');
    }

    const quantity = dto.quantity ?? 1;
    const cart = await this.getOrCreate(sessionId);
    const existing = cart.items.find((item) => item.productId === String(product._id));

    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.items.push({
        productId: String(product._id),
        slug: product.slug,
        name: product.name,
        quantity,
        unitPrice: {
          amount: product.price.amount,
          currency: product.price.currency,
        },
        imageUrl: product.imageUrl,
      });
    }

    await cart.save();
    const mapped = this.map(cart);
    this.realtime.emitCartUpdated(sessionId, mapped);
    return mapped;
  }
}
