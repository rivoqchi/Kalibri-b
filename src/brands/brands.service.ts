import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Brand, BrandDocument } from './brand.schema.js';
import { CreateBrandDto } from './dto/create-brand.dto.js';
import { UpdateBrandDto } from './dto/update-brand.dto.js';
import { toSlug } from '../common/utils/slug.js';

@Injectable()
export class BrandsService {
  constructor(
    @InjectModel(Brand.name) private readonly brandModel: Model<BrandDocument>,
  ) {}

  private map(doc: BrandDocument) {
    return {
      id: String(doc._id),
      name: doc.name,
      slug: doc.slug,
      imageUrl: doc.imageUrl,
      isActive: doc.isActive,
    };
  }

  async create(dto: CreateBrandDto) {
    const slug = dto.slug ? toSlug(dto.slug) : toSlug(dto.name);
    try {
      const created = await this.brandModel.create({ ...dto, slug });
      return this.map(created);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('Slug');
      }
      throw error;
    }
  }

  async findAll() {
    const docs = await this.brandModel
      .find({ isActive: true })
      .sort({ name: 1 })
      .exec();
    return docs.map((doc) => this.map(doc));
  }

  async findAllAdmin() {
    const docs = await this.brandModel.find().sort({ name: 1 }).exec();
    return docs.map((doc) => this.map(doc));
  }

  async update(id: string, dto: UpdateBrandDto) {
    const doc = await this.brandModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Brand');

    if (dto.name !== undefined) doc.name = dto.name;
    if (dto.imageUrl !== undefined) doc.imageUrl = dto.imageUrl;
    if (dto.isActive !== undefined) doc.isActive = dto.isActive;
    if (dto.slug !== undefined) {
      doc.slug = toSlug(dto.slug);
    } else if (dto.name !== undefined) {
      doc.slug = toSlug(dto.name);
    }

    try {
      await doc.save();
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('Slug');
      }
      throw error;
    }

    return this.map(doc);
  }

  async remove(id: string) {
    const doc = await this.brandModel.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('Brand');
    return { ok: true, id };
  }
}
