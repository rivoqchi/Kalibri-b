import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  ProductDirection,
  ProductDirectionDocument,
} from './product-direction.schema.js';
import { CreateProductDirectionDto } from './dto/create-product-direction.dto.js';
import { UpdateProductDirectionDto } from './dto/update-product-direction.dto.js';

@Injectable()
export class ProductDirectionsService {
  constructor(
    @InjectModel(ProductDirection.name)
    private readonly directionModel: Model<ProductDirectionDocument>,
  ) {}

  private map(doc: ProductDirectionDocument) {
    return {
      id: String(doc._id),
      name: doc.name,
      imageUrl: doc.imageUrl,
      productIds: (doc.productIds ?? []).map((id) => String(id)),
      isActive: doc.isActive,
    };
  }

  private toObjectIds(ids: string[] | undefined) {
    if (!ids) return [];
    return ids.map((id) => new Types.ObjectId(id));
  }

  async create(dto: CreateProductDirectionDto) {
    const created = await this.directionModel.create({
      name: dto.name.trim(),
      imageUrl: dto.imageUrl.trim(),
      productIds: this.toObjectIds(dto.productIds),
      isActive: dto.isActive ?? true,
    });
    return this.map(created);
  }

  async findAll() {
    const docs = await this.directionModel
      .find({ isActive: true })
      .sort({ name: 1 })
      .exec();
    return docs.map((doc) => this.map(doc));
  }

  async findAllAdmin() {
    const docs = await this.directionModel.find().sort({ name: 1 }).exec();
    return docs.map((doc) => this.map(doc));
  }

  async update(id: string, dto: UpdateProductDirectionDto) {
    const doc = await this.directionModel.findById(id).exec();
    if (!doc) throw new NotFoundException('ProductDirection');

    if (dto.name !== undefined) doc.name = dto.name.trim();
    if (dto.imageUrl !== undefined) doc.imageUrl = dto.imageUrl.trim();
    if (dto.productIds !== undefined) {
      doc.productIds = this.toObjectIds(dto.productIds);
    }
    if (dto.isActive !== undefined) doc.isActive = dto.isActive;

    await doc.save();
    return this.map(doc);
  }

  async remove(id: string) {
    const doc = await this.directionModel.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('ProductDirection');
    return { ok: true, id };
  }
}
