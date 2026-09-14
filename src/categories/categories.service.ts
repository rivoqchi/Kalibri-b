import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache/cache.module.js';
import { Category, CategoryDocument } from './category.schema.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { toSlug } from '../common/utils/slug.js';

@Injectable()
export class CategoriesService {
  constructor(
    @InjectModel(Category.name)
    private readonly categoryModel: Model<CategoryDocument>,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
  ) {}

  private map(doc: CategoryDocument) {
    return {
      id: String(doc._id),
      slug: doc.slug,
      name: doc.name,
      description: doc.description,
      imageUrl: doc.imageUrl,
      isActive: doc.isActive,
      seoTitle: doc.seoTitle,
      seoDescription: doc.seoDescription,
      seoKeywords: doc.seoKeywords,
    };
  }

  private async clearCache() {
    await this.cache.delByPrefix('categories:');
  }

  async create(dto: CreateCategoryDto) {
    const slug = dto.slug ? toSlug(dto.slug) : toSlug(dto.name);
    try {
      const created = await this.categoryModel.create({ ...dto, slug });
      await this.clearCache();
      return this.map(created);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('Slug');
      }
      throw error;
    }
  }

  async findAll() {
    const cacheKey = 'categories:list';
    const cached =
      await this.cache.get<ReturnType<CategoriesService['map']>[]>(cacheKey);
    if (cached) return cached;

    const docs = await this.categoryModel
      .find({ isActive: true })
      .sort({ name: 1 })
      .exec();
    const result = docs.map((doc) => this.map(doc));
    await this.cache.set(
      cacheKey,
      result,
      this.config.get<number>('cacheTtlSeconds') ?? 60,
    );
    return result;
  }

  async findAllAdmin() {
    const docs = await this.categoryModel.find().sort({ name: 1 }).exec();
    return docs.map((doc) => this.map(doc));
  }

  async findBySlug(slug: string) {
    const cacheKey = `categories:slug:${slug}`;
    const cached =
      await this.cache.get<ReturnType<CategoriesService['map']>>(cacheKey);
    if (cached) return cached;

    const doc = await this.categoryModel.findOne({ slug, isActive: true }).exec();
    if (!doc) throw new NotFoundException(`Category not found: ${slug}`);

    const mapped = this.map(doc);
    await this.cache.set(
      cacheKey,
      mapped,
      this.config.get<number>('cacheTtlSeconds') ?? 60,
    );
    return mapped;
  }

  async update(id: string, dto: UpdateCategoryDto) {
    const doc = await this.categoryModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Category');

    if (dto.name !== undefined) doc.name = dto.name;
    if (dto.description !== undefined) doc.description = dto.description;
    if (dto.imageUrl !== undefined) doc.imageUrl = dto.imageUrl;
    if (dto.isActive !== undefined) doc.isActive = dto.isActive;
    if (dto.seoTitle !== undefined) doc.seoTitle = dto.seoTitle;
    if (dto.seoDescription !== undefined) doc.seoDescription = dto.seoDescription;
    if (dto.seoKeywords !== undefined) doc.seoKeywords = dto.seoKeywords;

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

    await this.clearCache();
    return this.map(doc);
  }

  async remove(id: string) {
    const doc = await this.categoryModel.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('Category');
    await this.clearCache();
    return { ok: true, id };
  }
}
