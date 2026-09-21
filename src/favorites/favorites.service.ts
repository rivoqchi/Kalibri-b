import {
  BadRequestException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Favorites, FavoritesDocument } from './favorites.schema.js';
import { Product, ProductDocument } from '../products/product.schema.js';
import { AddFavoriteItemDto } from './dto/add-favorite-item.dto.js';
import { ReplaceFavoritesDto } from './dto/replace-favorites.dto.js';

type FavoritesOwner = {
  userId?: string;
  sessionId?: string;
};

@Injectable()
export class FavoritesService implements OnModuleInit {
  constructor(
    @InjectModel(Favorites.name)
    private readonly favoritesModel: Model<FavoritesDocument>,
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {}

  async onModuleInit() {
    try {
      await this.favoritesModel.collection.dropIndex('sessionId_1');
    } catch {
      // Index may already be gone or named differently.
    }
  }

  private resolveOwner(userId?: string, sessionId?: string): FavoritesOwner {
    const sid = sessionId?.trim();
    const uid = userId?.trim();
    if (uid) return { userId: uid, sessionId: sid || undefined };
    if (sid) return { sessionId: sid };
    throw new BadRequestException('Authorization yoki x-session-id kerak.');
  }

  private map(doc: FavoritesDocument) {
    return {
      userId: doc.userId,
      sessionId: doc.sessionId,
      productIds: [...(doc.productIds ?? [])],
    };
  }

  private async mergeGuestIntoUser(userId: string, sessionId?: string) {
    if (!sessionId) return;

    const guest = await this.favoritesModel
      .findOne({ sessionId, userId: { $exists: false } })
      .exec();
    if (!guest) return;

    let userDoc = await this.favoritesModel.findOne({ userId }).exec();
    if (!userDoc) {
      await this.favoritesModel
        .findByIdAndUpdate(guest._id, {
          $set: { userId },
          $unset: { sessionId: 1 },
        })
        .exec();
      return;
    }

    const seen = new Set(userDoc.productIds);
    for (const productId of guest.productIds) {
      if (!seen.has(productId)) {
        userDoc.productIds.push(productId);
        seen.add(productId);
      }
    }

    await userDoc.save();
    await guest.deleteOne();
  }

  private async getOrCreate(owner: FavoritesOwner) {
    if (owner.userId) {
      await this.mergeGuestIntoUser(owner.userId, owner.sessionId);
      const existing = await this.favoritesModel
        .findOne({ userId: owner.userId })
        .exec();
      if (existing) return existing;
      return this.favoritesModel.create({
        userId: owner.userId,
        productIds: [],
      });
    }

    const existing = await this.favoritesModel
      .findOne({
        sessionId: owner.sessionId,
        userId: { $exists: false },
      })
      .exec();
    if (existing) return existing;
    return this.favoritesModel.create({
      sessionId: owner.sessionId,
      productIds: [],
    });
  }

  async getFavorites(userId?: string, sessionId?: string) {
    const owner = this.resolveOwner(userId, sessionId);
    const doc = await this.getOrCreate(owner);
    return this.map(doc);
  }

  async addItem(
    userId: string | undefined,
    sessionId: string | undefined,
    dto: AddFavoriteItemDto,
  ) {
    const owner = this.resolveOwner(userId, sessionId);

    const product = await this.productModel.findById(dto.productId).exec();
    if (!product || !product.isActive) {
      throw new NotFoundException('Product not found');
    }

    const doc = await this.getOrCreate(owner);
    const productId = String(product._id);
    if (!doc.productIds.includes(productId)) {
      doc.productIds.push(productId);
      await doc.save();
    }

    return this.map(doc);
  }

  async removeItem(
    userId: string | undefined,
    sessionId: string | undefined,
    productId: string,
  ) {
    const owner = this.resolveOwner(userId, sessionId);
    const doc = await this.getOrCreate(owner);
    doc.productIds = doc.productIds.filter((id) => id !== productId);
    await doc.save();
    return this.map(doc);
  }

  async replaceAll(
    userId: string | undefined,
    sessionId: string | undefined,
    dto: ReplaceFavoritesDto,
  ) {
    const owner = this.resolveOwner(userId, sessionId);
    const doc = await this.getOrCreate(owner);

    const unique: string[] = [];
    const seen = new Set<string>();
    for (const raw of dto.productIds) {
      const id = String(raw).trim();
      if (!id || seen.has(id)) continue;
      seen.add(id);
      unique.push(id);
    }

    doc.productIds = unique;
    await doc.save();
    return this.map(doc);
  }
}
