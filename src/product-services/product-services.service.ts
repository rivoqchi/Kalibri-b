import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  ProductService,
  ProductServiceDocument,
} from './product-service.schema.js';
import { CreateProductServiceDto } from './dto/create-product-service.dto.js';
import { UpdateProductServiceDto } from './dto/update-product-service.dto.js';

@Injectable()
export class ProductServicesService {
  constructor(
    @InjectModel(ProductService.name)
    private readonly productServiceModel: Model<ProductServiceDocument>,
  ) {}

  private map(doc: ProductServiceDocument) {
    return {
      id: String(doc._id),
      name: doc.name,
      imageUrl: doc.imageUrl,
      phone: doc.phone ?? '',
      isActive: doc.isActive,
    };
  }

  async create(dto: CreateProductServiceDto) {
    const created = await this.productServiceModel.create({
      name: dto.name.trim(),
      imageUrl: dto.imageUrl.trim(),
      phone: (dto.phone ?? '').trim(),
      isActive: dto.isActive ?? true,
    });
    return this.map(created);
  }

  async findAll() {
    const docs = await this.productServiceModel
      .find({ isActive: true })
      .sort({ name: 1 })
      .exec();
    return docs.map((doc) => this.map(doc));
  }

  async findAllAdmin() {
    const docs = await this.productServiceModel.find().sort({ name: 1 }).exec();
    return docs.map((doc) => this.map(doc));
  }

  async update(id: string, dto: UpdateProductServiceDto) {
    const doc = await this.productServiceModel.findById(id).exec();
    if (!doc) throw new NotFoundException('ProductService');

    if (dto.name !== undefined) doc.name = dto.name.trim();
    if (dto.imageUrl !== undefined) doc.imageUrl = dto.imageUrl.trim();
    if (dto.phone !== undefined) doc.phone = dto.phone.trim();
    if (dto.isActive !== undefined) doc.isActive = dto.isActive;

    await doc.save();
    return this.map(doc);
  }

  async remove(id: string) {
    const doc = await this.productServiceModel.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('ProductService');
    return { ok: true, id };
  }
}
