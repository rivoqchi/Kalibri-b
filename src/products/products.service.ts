import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache/cache.module.js';
import { Product, ProductDocument } from './product.schema.js';
import { Category, CategoryDocument } from '../categories/category.schema.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { ListProductsQueryDto } from './dto/list-products.dto.js';
import { toSlug } from '../common/utils/slug.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
    private readonly realtime: RealtimeGateway,
  ) {}

  private mapProduct(doc: ProductDocument) {
    return {
      id: String(doc._id),
      slug: doc.slug,
      name: doc.name,
      description: doc.description,
      price: {
        amount: doc.price.amount,
        currency: doc.price.currency,
      },
      imageUrl: doc.imageUrl,
      imageUrls: doc.imageUrls,
      categorySlug: doc.categorySlug,
      brand: doc.brand,
      model: doc.modelName,
      inStock: doc.inStock,
      stockQty: doc.stockQty,
      isNewArrival: doc.isNewArrival,
      searchTags: doc.searchTags,
      seoTitle: doc.seoTitle,
      seoDescription: doc.seoDescription,
      seoKeywords: doc.seoKeywords,
      updatedAt: doc.get('updatedAt'),
    };
  }

  async create(dto: CreateProductDto) {
    const slug = dto.slug ? toSlug(dto.slug) : toSlug(dto.name);
    let categoryId: ProductDocument['categoryId'];

    if (dto.categorySlug) {
      const category = await this.categoryModel.findOne({ slug: dto.categorySlug }).lean();
      if (category) categoryId = category._id;
    }

    const created = await this.productModel.create({
      ...dto,
      slug,
      categoryId,
      imageUrls: dto.imageUrls ?? [],
      searchTags: dto.searchTags ?? [],
      seoKeywords: dto.seoKeywords ?? [],
      inStock: dto.inStock ?? true,
      stockQty: dto.stockQty ?? 0,
      isNewArrival: dto.isNewArrival ?? false,
    });

    await this.cache.delByPrefix('products:');
    this.realtime.emitProductUpdated(this.mapProduct(created));
    return this.mapProduct(created);
  }

  async findAll(query: ListProductsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;
    const cacheKey = `products:list:${JSON.stringify(query)}`;
    const cached = await this.cache.get<{
      items: ReturnType<ProductsService['mapProduct']>[];
      total: number;
      page: number;
      limit: number;
    }>(cacheKey);
    if (cached) return cached;

    const filter: Record<string, unknown> = { isActive: true };

    if (query.category) filter.categorySlug = query.category;
    if (query.brand) filter.brand = new RegExp(`^${query.brand}$`, 'i');
    if (query.inStock !== undefined) filter.inStock = query.inStock;
    if (query.minPrice !== undefined || query.maxPrice !== undefined) {
      filter['price.amount'] = {
        ...(query.minPrice !== undefined ? { $gte: query.minPrice } : {}),
        ...(query.maxPrice !== undefined ? { $lte: query.maxPrice } : {}),
      };
    }

    if (query.q) {
      filter.$text = { $search: query.q };
    }

    let sort: Record<string, 1 | -1 | { $meta: string }> = { updatedAt: -1 };
    switch (query.sort) {
      case 'price_asc':
        sort = { 'price.amount': 1 };
        break;
      case 'price_desc':
        sort = { 'price.amount': -1 };
        break;
      case 'newest':
        sort = { isNewArrival: -1, updatedAt: -1 };
        break;
      case 'bestseller':
        sort = { soldCount: -1 };
        break;
      case 'relevance':
        if (query.q) sort = { score: { $meta: 'textScore' } };
        break;
      default:
        break;
    }

    const findQuery = this.productModel.find(filter);
    if (query.q && query.sort === 'relevance') {
      findQuery.select({ score: { $meta: 'textScore' } });
    }

    const [docs, total] = await Promise.all([
      findQuery
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .exec(),
      this.productModel.countDocuments(filter),
    ]);

    const result = {
      items: docs.map((doc) => this.mapProduct(doc)),
      total,
      page,
      limit,
    };

    const ttl = this.config.get<number>('cacheTtlSeconds') ?? 60;
    await this.cache.set(cacheKey, result, ttl);
    return result;
  }

  async findBySlug(slug: string) {
    const cacheKey = `products:slug:${slug}`;
    const cached = await this.cache.get<ReturnType<ProductsService['mapProduct']>>(cacheKey);
    if (cached) return cached;

    const doc = await this.productModel.findOne({ slug, isActive: true }).exec();
    if (!doc) throw new NotFoundException(`Product not found: ${slug}`);

    const mapped = this.mapProduct(doc);
    await this.cache.set(cacheKey, mapped, this.config.get<number>('cacheTtlSeconds') ?? 60);
    return mapped;
  }

  async updateStock(productId: string, stockQty: number) {
    const doc = await this.productModel
      .findByIdAndUpdate(
        productId,
        { stockQty, inStock: stockQty > 0 },
        { new: true },
      )
      .exec();
    if (!doc) throw new NotFoundException('Product not found');

    await this.cache.delByPrefix('products:');
    const mapped = this.mapProduct(doc);
    this.realtime.emitStockChanged({
      productId: mapped.id,
      slug: mapped.slug,
      stockQty: mapped.stockQty,
      inStock: mapped.inStock,
    });
    return mapped;
  }
}
