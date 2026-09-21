import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Cart, CartDocument } from './cart.schema.js';
import { Product, ProductDocument } from '../products/product.schema.js';
import { AddCartItemDto } from './dto/add-cart-item.dto.js';
import { UpdateCartItemDto } from './dto/update-cart-item.dto.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

type CartOwner = {
  userId?: string;
  sessionId?: string;
};

@Injectable()
export class CartService implements OnModuleInit {
  constructor(
    @InjectModel(Cart.name) private readonly cartModel: Model<CartDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    private readonly realtime: RealtimeGateway,
  ) {}

  async onModuleInit() {
    // Legacy unique index from session-only schema blocks user carts.
    try {
      await this.cartModel.collection.dropIndex('sessionId_1');
    } catch {
      // Index may already be gone or named differently.
    }
  }

  private resolveOwner(userId?: string, sessionId?: string): CartOwner {
    const sid = sessionId?.trim();
    const uid = userId?.trim();
    if (uid) return { userId: uid, sessionId: sid || undefined };
    if (sid) return { sessionId: sid };
    throw new BadRequestException('Authorization yoki x-session-id kerak.');
  }

  private map(cart: CartDocument) {
    const items = cart.items.map((item) => ({
      productId: item.productId,
      slug: item.slug,
      name: item.name,
      quantity: item.quantity,
      unitPrice: {
        amount: Number(item.unitPrice?.amount),
        currency: item.unitPrice?.currency || 'UZS',
      },
      imageUrl: item.imageUrl,
    }));

    const currency = items[0]?.unitPrice.currency ?? 'UZS';
    const subtotalAmount = items.reduce(
      (sum, item) => sum + item.unitPrice.amount * item.quantity,
      0,
    );

    return {
      userId: cart.userId,
      sessionId: cart.sessionId,
      items,
      subtotal: { amount: subtotalAmount, currency },
    };
  }

  private emitUpdate(owner: CartOwner, mapped: ReturnType<CartService['map']>) {
    if (owner.userId) this.realtime.emitCartUpdated(owner.userId, mapped);
    if (owner.sessionId) this.realtime.emitCartUpdated(owner.sessionId, mapped);
  }

  private async mergeGuestIntoUser(userId: string, sessionId?: string) {
    if (!sessionId) return;

    const guest = await this.cartModel
      .findOne({ sessionId, userId: { $exists: false } })
      .exec();
    if (!guest) return;

    let userCart = await this.cartModel.findOne({ userId }).exec();
    if (!userCart) {
      await this.cartModel
        .findByIdAndUpdate(guest._id, {
          $set: { userId },
          $unset: { sessionId: 1 },
        })
        .exec();
      return;
    }

    for (const guestItem of guest.items) {
      const existing = userCart.items.find(
        (item) => item.productId === guestItem.productId,
      );
      if (existing) {
        existing.quantity += guestItem.quantity;
      } else {
        userCart.items.push(guestItem);
      }
    }

    await userCart.save();
    await guest.deleteOne();
  }

  private async getOrCreate(owner: CartOwner) {
    if (owner.userId) {
      await this.mergeGuestIntoUser(owner.userId, owner.sessionId);
      const existing = await this.cartModel
        .findOne({ userId: owner.userId })
        .exec();
      if (existing) return existing;
      return this.cartModel.create({
        userId: owner.userId,
        items: [],
      });
    }

    const existing = await this.cartModel
      .findOne({
        sessionId: owner.sessionId,
        userId: { $exists: false },
      })
      .exec();
    if (existing) return existing;
    return this.cartModel.create({
      sessionId: owner.sessionId,
      items: [],
    });
  }

  async getCart(userId?: string, sessionId?: string) {
    const owner = this.resolveOwner(userId, sessionId);
    const cart = await this.getOrCreate(owner);
    return this.map(cart);
  }

  async addItem(userId: string | undefined, sessionId: string | undefined, dto: AddCartItemDto) {
    const owner = this.resolveOwner(userId, sessionId);

    const product = await this.productModel.findById(dto.productId).exec();
    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }
    if (!product.inStock) {
      throw new BadRequestException('Product out of stock');
    }

    const quantity = dto.quantity ?? 1;
    const cart = await this.getOrCreate(owner);
    const productId = String(product._id);
    const existing = cart.items.find((item) => item.productId === productId);

    if (existing) {
      existing.quantity += quantity;
    } else {
      cart.items.push({
        productId,
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
    this.emitUpdate(owner, mapped);
    return mapped;
  }

  async setItemQuantity(
    userId: string | undefined,
    sessionId: string | undefined,
    productId: string,
    dto: UpdateCartItemDto,
  ) {
    const owner = this.resolveOwner(userId, sessionId);
    const cart = await this.getOrCreate(owner);

    if (dto.quantity <= 0) {
      cart.items = cart.items.filter((item) => item.productId !== productId);
    } else {
      const existing = cart.items.find((item) => item.productId === productId);
      if (!existing) {
        throw new NotFoundException('Cart item not found');
      }
      existing.quantity = dto.quantity;
    }

    await cart.save();
    const mapped = this.map(cart);
    this.emitUpdate(owner, mapped);
    return mapped;
  }

  async removeItem(
    userId: string | undefined,
    sessionId: string | undefined,
    productId: string,
  ) {
    const owner = this.resolveOwner(userId, sessionId);
    const cart = await this.getOrCreate(owner);
    cart.items = cart.items.filter((item) => item.productId !== productId);
    await cart.save();
    const mapped = this.map(cart);
    this.emitUpdate(owner, mapped);
    return mapped;
  }

  async clearCart(userId?: string, sessionId?: string) {
    const owner = this.resolveOwner(userId, sessionId);
    const cart = await this.getOrCreate(owner);
    cart.items = [];
    await cart.save();
    const mapped = this.map(cart);
    this.emitUpdate(owner, mapped);
    return mapped;
  }

  /** Clears DB cart after a successful order (JWT user). */
  async clearForUser(userId: string) {
    const cart = await this.cartModel.findOne({ userId }).exec();
    if (!cart) return;
    cart.items = [];
    await cart.save();
    this.emitUpdate({ userId }, this.map(cart));
  }
}
