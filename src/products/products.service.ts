import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache/cache.module.js';
import { Product, ProductDocument } from './product.schema.js';
import { Category, CategoryDocument } from '../categories/category.schema.js';
import {
  Attribute,
  AttributeDocument,
} from '../attributes/attribute.schema.js';
import {
  ProductDirection,
  ProductDirectionDocument,
} from '../product-directions/product-direction.schema.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ListProductsQueryDto } from './dto/list-products.dto.js';
import { ListAdminProductsQueryDto } from './dto/list-admin-products.dto.js';
import { toSlug } from '../common/utils/slug.js';
import { RealtimeGateway } from '../realtime/realtime.gateway.js';
import {
  PRODUCT_NEW_STATUS_DAYS,
  PRODUCT_STATUS_TAGS,
  ProductStatusTag,
} from './product-status.constants.js';

@Injectable()
export class ProductsService {
  constructor(
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Attribute.name)
    private readonly attributeModel: Model<AttributeDocument>,
    @InjectModel(ProductDirection.name)
    private readonly directionModel: Model<ProductDirectionDocument>,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
    private readonly realtime: RealtimeGateway,
  ) {}

  private daysFromNow(days: number) {
    return new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  }

  /**
   * Unlimited (cheksiz): stockUnlimited=true → inStock always true, stockQty ignored (stored 0).
   * Limited: stockUnlimited=false → stockQty integer >= 0, inStock = stockQty > 0.
   */
  private resolveStock(
    dto: { stockUnlimited?: boolean; stockQty?: number },
    existing?: ProductDocument,
  ): { stockUnlimited: boolean; stockQty: number; inStock: boolean } {
    const unlimited =
      dto.stockUnlimited !== undefined
        ? dto.stockUnlimited
        : (existing?.stockUnlimited ?? true);

    if (unlimited) {
      return { stockUnlimited: true, stockQty: 0, inStock: true };
    }

    const qty =
      dto.stockQty !== undefined ? dto.stockQty : existing?.stockQty;

    if (
      qty === undefined ||
      !Number.isInteger(qty) ||
      qty < 0
    ) {
      throw new BadRequestException('stockQty');
    }

    return {
      stockUnlimited: false,
      stockQty: qty,
      inStock: qty > 0,
    };
  }

  private normalizeStatusTags(statusTags?: string[]) {
    const allowed = new Set<string>(PRODUCT_STATUS_TAGS);
    const unique = [
      ...new Set((statusTags ?? []).filter((tag) => allowed.has(tag))),
    ] as ProductStatusTag[];
    return unique;
  }

  private getEffectiveStatusTags(doc: ProductDocument): ProductStatusTag[] {
    const now = Date.now();
    let tags = this.normalizeStatusTags(doc.statusTags);

    if (
      tags.includes('new') &&
      doc.newExpiresAt &&
      doc.newExpiresAt.getTime() <= now
    ) {
      tags = tags.filter((tag) => tag !== 'new');
    }

    if (
      tags.includes('seasonal') &&
      doc.seasonalExpiresAt &&
      doc.seasonalExpiresAt.getTime() <= now
    ) {
      tags = tags.filter((tag) => tag !== 'seasonal');
    }

    return tags;
  }

  private resolveStatusFields(
    statusTags: string[] | undefined,
    seasonalDays: number | undefined,
    existing?: ProductDocument,
  ) {
    const unique = this.normalizeStatusTags(statusTags);
    const hadNew = existing?.statusTags?.includes('new') ?? false;
    const hadSeasonal = existing?.statusTags?.includes('seasonal') ?? false;

    let newExpiresAt: Date | null | undefined;
    let seasonalExpiresAt: Date | null | undefined;

    if (unique.includes('new')) {
      if (!hadNew || !existing?.newExpiresAt) {
        newExpiresAt = this.daysFromNow(PRODUCT_NEW_STATUS_DAYS);
      }
    } else {
      newExpiresAt = null;
    }

    if (unique.includes('seasonal')) {
      if (seasonalDays !== undefined && seasonalDays > 0) {
        seasonalExpiresAt = this.daysFromNow(seasonalDays);
      } else if (!hadSeasonal || !existing?.seasonalExpiresAt) {
        throw new BadRequestException('seasonalDays');
      }
    } else {
      seasonalExpiresAt = null;
    }

    return {
      statusTags: unique,
      isNewArrival: unique.includes('new'),
      newExpiresAt,
      seasonalExpiresAt,
    };
  }

  mapProduct(doc: ProductDocument) {
    const statusTags = this.getEffectiveStatusTags(doc);
    const description =
      doc.description != null && doc.description.length > 0
        ? doc.description
        : undefined;

    return {
      id: String(doc._id),
      slug: doc.slug,
      code: doc.code,
      name: doc.name,
      description,
      price: {
        amount: doc.price.amount,
        currency: doc.price.currency,
      },
      salePrice: doc.salePrice
        ? {
            amount: doc.salePrice.amount,
            currency: doc.salePrice.currency,
          }
        : null,
      imageUrl: doc.imageUrl,
      imageUrls: doc.imageUrls ?? [],
      categorySlug: doc.categorySlug,
      brand: doc.brand,
      model: doc.modelName,
      stockUnlimited: doc.stockUnlimited ?? true,
      inStock: doc.inStock,
      stockQty: doc.stockQty,
      isNewArrival: statusTags.includes('new'),
      attributeIds: (doc.attributeIds ?? []).map((id) => String(id)),
      statusTags,
      newExpiresAt: doc.newExpiresAt?.toISOString() ?? null,
      seasonalExpiresAt: doc.seasonalExpiresAt?.toISOString() ?? null,
      searchTags: doc.searchTags,
      seoTitle: doc.seoTitle,
      seoDescription: doc.seoDescription,
      seoKeywords: doc.seoKeywords,
      isActive: doc.isActive,
      soldCount: doc.soldCount,
      updatedAt: doc.get('updatedAt'),
    };
  }

  private async resolveCategory(categorySlug?: string) {
    if (!categorySlug) return { categoryId: undefined, categorySlug: undefined };
    const category = await this.categoryModel.findOne({ slug: categorySlug }).lean();
    if (!category) return { categoryId: undefined, categorySlug: undefined };
    return { categoryId: category._id, categorySlug: category.slug };
  }

  private duplicateConflict(error: unknown): never {
    const key = (error as { keyPattern?: Record<string, number> }).keyPattern;
    if (key?.code) throw new ConflictException('Code');
    throw new ConflictException('Slug');
  }

  async create(dto: CreateProductDto) {
    const slug = dto.slug ? toSlug(dto.slug) : toSlug(dto.name);
    const category = await this.resolveCategory(dto.categorySlug);
    const status = this.resolveStatusFields(dto.statusTags, dto.seasonalDays);
    const imageUrls = dto.imageUrls ?? [];
    const imageUrl = dto.imageUrl ?? imageUrls[0];
    const description =
      dto.description != null && dto.description.length > 0
        ? dto.description
        : undefined;

    const stock = this.resolveStock(dto);

    try {
      const created = await this.productModel.create({
        name: dto.name.trim(),
        code: dto.code.trim(),
        slug,
        description,
        price: dto.price,
        salePrice: dto.salePrice,
        imageUrl,
        imageUrls,
        categoryId: category.categoryId,
        categorySlug: category.categorySlug ?? dto.categorySlug,
        brand: dto.brand?.trim() || undefined,
        modelName: dto.modelName?.trim() || undefined,
        attributeIds: (dto.attributeIds ?? []).map((id) => new Types.ObjectId(id)),
        statusTags: status.statusTags,
        isNewArrival: status.isNewArrival,
        newExpiresAt: status.newExpiresAt ?? undefined,
        seasonalExpiresAt: status.seasonalExpiresAt ?? undefined,
        searchTags: dto.searchTags ?? [],
        seoTitle: dto.seoTitle,
        seoDescription: dto.seoDescription,
        seoKeywords: dto.seoKeywords ?? [],
        stockUnlimited: stock.stockUnlimited,
        inStock: stock.inStock,
        stockQty: stock.stockQty,
        isActive: true,
      });

      await this.cache.delByPrefix('products:');
      await this.cache.del('search:vocab:v2');
      this.realtime.emitProductUpdated(this.mapProduct(created));
      return this.mapProduct(created);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        this.duplicateConflict(error);
      }
      throw error;
    }
  }

  async findAllAdmin(query: ListAdminProductsQueryDto = {}) {
    if (query.ids?.length) {
      const docs = await this.productModel
        .find({ _id: { $in: query.ids.map((id) => new Types.ObjectId(id)) } })
        .exec();
      return docs.map((doc) => this.mapProduct(doc));
    }

    const q = query.q?.trim();
    if (q) {
      const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const re = new RegExp(escaped, 'i');
      const limit = query.limit ?? 30;
      const docs = await this.productModel
        .find({ $or: [{ name: re }, { code: re }] })
        .sort({ updatedAt: -1 })
        .limit(limit)
        .exec();
      return docs.map((doc) => this.mapProduct(doc));
    }

    const docs = await this.productModel.find().sort({ updatedAt: -1 }).exec();
    return docs.map((doc) => this.mapProduct(doc));
  }

  async update(id: string, dto: UpdateProductDto) {
    const existing = await this.productModel.findById(id).exec();
    if (!existing) throw new NotFoundException('Product not found');

    const updateData: Record<string, unknown> = {};

    if (dto.name !== undefined) updateData.name = dto.name.trim();
    if (dto.code !== undefined) updateData.code = dto.code.trim();
    if (dto.description !== undefined) {
      updateData.description =
        dto.description.length > 0 ? dto.description : undefined;
    }
    if (dto.price !== undefined) updateData.price = dto.price;
    if (dto.salePrice !== undefined) {
      updateData.salePrice = dto.salePrice === null ? null : dto.salePrice;
    }
    if (dto.imageUrl !== undefined) updateData.imageUrl = dto.imageUrl;
    if (dto.imageUrls !== undefined) {
      updateData.imageUrls = dto.imageUrls;
      if (dto.imageUrl === undefined) {
        updateData.imageUrl = dto.imageUrls[0];
      }
    }
    if (dto.brand !== undefined) updateData.brand = dto.brand.trim() || undefined;
    if (dto.modelName !== undefined) {
      updateData.modelName = dto.modelName.trim() || undefined;
    }
    if (dto.isActive !== undefined) updateData.isActive = dto.isActive;
    if (dto.searchTags !== undefined) updateData.searchTags = dto.searchTags;
    if (dto.seoTitle !== undefined) updateData.seoTitle = dto.seoTitle;
    if (dto.seoDescription !== undefined) {
      updateData.seoDescription = dto.seoDescription;
    }
    if (dto.seoKeywords !== undefined) updateData.seoKeywords = dto.seoKeywords;

    if (dto.stockUnlimited !== undefined || dto.stockQty !== undefined) {
      const stock = this.resolveStock(dto, existing);
      updateData.stockUnlimited = stock.stockUnlimited;
      updateData.stockQty = stock.stockQty;
      updateData.inStock = stock.inStock;
    }

    if (dto.categorySlug !== undefined) {
      const category = await this.resolveCategory(dto.categorySlug);
      updateData.categoryId = category.categoryId;
      updateData.categorySlug = category.categorySlug;
    }

    if (dto.attributeIds !== undefined) {
      updateData.attributeIds = dto.attributeIds.map(
        (aid) => new Types.ObjectId(aid),
      );
    }

    if (dto.statusTags !== undefined) {
      const status = this.resolveStatusFields(
        dto.statusTags,
        dto.seasonalDays,
        existing,
      );
      updateData.statusTags = status.statusTags;
      updateData.isNewArrival = status.isNewArrival;
      if (status.newExpiresAt !== undefined) {
        updateData.newExpiresAt = status.newExpiresAt;
      }
      if (status.seasonalExpiresAt !== undefined) {
        updateData.seasonalExpiresAt = status.seasonalExpiresAt;
      }
    } else if (dto.isNewArrival !== undefined) {
      updateData.isNewArrival = dto.isNewArrival;
    }

    if (dto.name && !dto.slug) {
      updateData.slug = toSlug(dto.name);
    } else if (dto.slug) {
      updateData.slug = toSlug(dto.slug);
    }

    try {
      const doc = await this.productModel
        .findByIdAndUpdate(id, updateData, { new: true })
        .exec();
      if (!doc) throw new NotFoundException('Product not found');

      await this.cache.delByPrefix('products:');
      await this.cache.del('search:vocab:v2');
      const mapped = this.mapProduct(doc);
      this.realtime.emitProductUpdated(mapped);
      return mapped;
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        this.duplicateConflict(error);
      }
      throw error;
    }
  }

  async remove(id: string) {
    const doc = await this.productModel.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('Product not found');

    await this.cache.delByPrefix('products:');
    await this.cache.del('search:vocab:v2');
    return { ok: true, id };
  }

  async findAll(query: ListProductsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;

    if (query.ids?.length) {
      const items = await this.findActiveByIds(query.ids);
      return { items, total: items.length, page: 1, limit: items.length };
    }

    const cacheKey = `products:list:${JSON.stringify(query)}`;
    const cached = await this.cache.get<{
      items: ReturnType<ProductsService['mapProduct']>[];
      total: number;
      page: number;
      limit: number;
    }>(cacheKey);
    if (cached) return cached;

    const filter: Record<string, unknown> = { isActive: true };
    const emptyResult = { items: [], total: 0, page, limit };

    if (query.direction) {
      if (!Types.ObjectId.isValid(query.direction)) {
        return emptyResult;
      }
      const direction = await this.directionModel
        .findOne({ _id: query.direction, isActive: true })
        .select('productIds')
        .lean()
        .exec();
      if (!direction?.productIds?.length) {
        return emptyResult;
      }
      filter._id = { $in: direction.productIds };
    }

    if (query.category) filter.categorySlug = query.category;
    if (query.brand) filter.brand = new RegExp(`^${query.brand}$`, 'i');
    if (query.inStock !== undefined) filter.inStock = query.inStock;
    if (query.excludeId && Types.ObjectId.isValid(query.excludeId)) {
      const excludeOid = new Types.ObjectId(query.excludeId);
      const existingId = filter._id as
        | { $in?: Types.ObjectId[]; $ne?: Types.ObjectId }
        | undefined;
      if (existingId?.$in) {
        filter._id = { $in: existingId.$in, $ne: excludeOid };
      } else {
        filter._id = { $ne: excludeOid };
      }
    }
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

  async getPriceRange() {
    const cacheKey = 'products:price-range';
    const cached = await this.cache.get<{ min: number; max: number }>(
      cacheKey,
    );
    if (cached) return cached;

    const [row] = await this.productModel
      .aggregate<{ min: number | null; max: number | null }>([
        { $match: { isActive: true } },
        {
          $group: {
            _id: null,
            min: { $min: '$price.amount' },
            max: { $max: '$price.amount' },
          },
        },
      ])
      .exec();

    const min = Number.isFinite(row?.min) ? Number(row!.min) : 0;
    const max = Number.isFinite(row?.max) ? Number(row!.max) : 0;
    const result = {
      min,
      max: max < min ? min : max,
    };

    const ttl = this.config.get<number>('cacheTtlSeconds') ?? 60;
    await this.cache.set(cacheKey, result, ttl);
    return result;
  }

  private async resolveAttributes(attributeIds?: Types.ObjectId[]) {
    if (!attributeIds?.length) return [];

    const docs = await this.attributeModel
      .find({ _id: { $in: attributeIds }, isActive: true })
      .exec();
    const byId = new Map(
      docs.map((doc) => [
        String(doc._id),
        {
          id: String(doc._id),
          name: doc.name,
          value: doc.value,
          unit: doc.unit ?? '',
          slug: doc.slug,
        },
      ]),
    );

    return attributeIds
      .map((id) => byId.get(String(id)))
      .filter((item): item is NonNullable<typeof item> => item != null);
  }

  async findActiveByIds(ids: string[]) {
    const objectIds = ids
      .filter((id) => Types.ObjectId.isValid(id))
      .map((id) => new Types.ObjectId(id));
    if (!objectIds.length) return [];

    const docs = await this.productModel
      .find({ _id: { $in: objectIds }, isActive: true })
      .exec();
    const byId = new Map(docs.map((doc) => [String(doc._id), doc]));
    const ordered: ReturnType<ProductsService['mapProduct']>[] = [];
    for (const id of ids) {
      const doc = byId.get(id);
      if (doc) ordered.push(this.mapProduct(doc));
    }
    return ordered;
  }

  async findBySlug(slug: string) {
    const cacheKey = `products:slug:${slug}`;
    const cached = await this.cache.get<
      ReturnType<ProductsService['mapProduct']> & {
        attributes: Awaited<ReturnType<ProductsService['resolveAttributes']>>;
      }
    >(cacheKey);
    if (cached) return cached;

    const doc = await this.productModel.findOne({ slug, isActive: true }).exec();
    if (!doc) throw new NotFoundException(`Product not found: ${slug}`);

    const mapped = this.mapProduct(doc);
    const attributes = await this.resolveAttributes(doc.attributeIds);
    const result = { ...mapped, attributes };
    await this.cache.set(cacheKey, result, this.config.get<number>('cacheTtlSeconds') ?? 60);
    return result;
  }

  async updateStock(productId: string, stockQty: number) {
    if (!Number.isInteger(stockQty) || stockQty < 0) {
      throw new BadRequestException('stockQty');
    }
    const doc = await this.productModel
      .findByIdAndUpdate(
        productId,
        {
          stockUnlimited: false,
          stockQty,
          inStock: stockQty > 0,
        },
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
