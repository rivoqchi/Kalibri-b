import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CacheService } from '../cache/cache.module.js';
import { Product, ProductDocument } from '../products/product.schema.js';
import { ProductsService } from '../products/products.service.js';
import {
  SearchHistory,
  SearchHistoryDocument,
} from './search-history.schema.js';
import {
  SearchRecentProduct,
  SearchRecentProductDocument,
} from './search-recent-product.schema.js';
import {
  RecordRecentProductDto,
  RecordSearchHistoryDto,
  SearchHistoryQueryDto,
  SearchProductsQueryDto,
  SearchRecentProductsQueryDto,
  SearchSuggestQueryDto,
} from './dto/search.dto.js';
import {
  buildCorrectedQuery,
  escapeRegex,
  normalizeSearchText,
  tokenizeSearchQuery,
} from './search-query.util.js';

type SearchOwner = {
  userId?: string;
  sessionId?: string;
};

@Injectable()
export class SearchService {
  private static readonly VOCAB_CACHE_KEY = 'search:vocab:v2';
  private static readonly VOCAB_TTL_MS = 120_000;
  private static readonly HISTORY_KEEP = 40;
  private static readonly RECENT_KEEP = 30;

  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
    @InjectModel(SearchHistory.name)
    private readonly historyModel: Model<SearchHistoryDocument>,
    @InjectModel(SearchRecentProduct.name)
    private readonly recentModel: Model<SearchRecentProductDocument>,
    private readonly productsService: ProductsService,
    private readonly cache: CacheService,
  ) {}

  private resolveOwner(
    userId?: string,
    sessionId?: string,
  ): SearchOwner {
    const sid = sessionId?.trim();
    const uid = userId?.trim();
    if (uid) return { userId: uid, sessionId: sid || undefined };
    if (sid) return { sessionId: sid };
    throw new BadRequestException('Authorization yoki x-session-id kerak.');
  }

  private ownerFilter(owner: SearchOwner): Record<string, unknown> {
    if (owner.userId) return { userId: owner.userId };
    return { sessionId: owner.sessionId, userId: { $exists: false } };
  }

  private async mergeGuestIntoUser(userId: string, sessionId?: string) {
    if (!sessionId) return;

    const guestHistory = await this.historyModel
      .find({ sessionId, userId: { $exists: false } })
      .sort({ searchedAt: -1 })
      .limit(SearchService.HISTORY_KEEP)
      .exec();

    for (const item of guestHistory) {
      await this.historyModel
        .findOneAndUpdate(
          { userId, queryKey: item.queryKey },
          {
            $set: {
              userId,
              query: item.query,
              queryKey: item.queryKey,
              correctedQuery: item.correctedQuery,
              searchedAt: item.searchedAt,
            },
            $unset: { sessionId: 1 },
          },
          { upsert: true },
        )
        .exec();
    }
    if (guestHistory.length) {
      await this.historyModel
        .deleteMany({ sessionId, userId: { $exists: false } })
        .exec();
    }

    const guestRecent = await this.recentModel
      .find({ sessionId, userId: { $exists: false } })
      .sort({ viewedAt: -1 })
      .limit(SearchService.RECENT_KEEP)
      .exec();

    for (const item of guestRecent) {
      await this.recentModel
        .findOneAndUpdate(
          { userId, productId: item.productId },
          {
            $set: {
              userId,
              productId: item.productId,
              viewedAt: item.viewedAt,
            },
            $unset: { sessionId: 1 },
          },
          { upsert: true },
        )
        .exec();
    }
    if (guestRecent.length) {
      await this.recentModel
        .deleteMany({ sessionId, userId: { $exists: false } })
        .exec();
    }
  }

  private async getVocabulary(): Promise<Set<string>> {
    const cached = await this.cache.get<string[]>(SearchService.VOCAB_CACHE_KEY);
    if (cached?.length) return new Set(cached);

    const docs = await this.productModel
      .find({ isActive: true })
      .select('name brand modelName searchTags seoKeywords code')
      .lean()
      .exec();

    const vocab = new Set<string>();
    for (const doc of docs) {
      for (const field of [
        doc.name,
        doc.brand,
        doc.modelName,
        ...(doc.searchTags ?? []),
        ...(doc.seoKeywords ?? []),
      ]) {
        if (!field) continue;
        for (const token of tokenizeSearchQuery(String(field))) {
          if (token.length >= 2 && !/\d/.test(token)) vocab.add(token);
        }
      }
    }

    await this.cache.set(
      SearchService.VOCAB_CACHE_KEY,
      [...vocab],
      Math.ceil(SearchService.VOCAB_TTL_MS / 1000),
    );
    return vocab;
  }

  private async mapProductsByIds(ids: string[]) {
    return this.productsService.findActiveByIds(ids);
  }

  async searchProducts(query: SearchProductsQueryDto) {
    const raw = query.q?.trim() ?? '';
    const page = query.page ?? 1;
    const limit = query.limit ?? 24;

    if (!raw) {
      return {
        items: [],
        total: 0,
        page,
        limit,
        query: '',
        correctedQuery: null as string | null,
        wasCorrected: false,
      };
    }

    const vocabulary = await this.getVocabulary();
    const correction = buildCorrectedQuery(raw, vocabulary);
    const searchText = correction.corrected || normalizeSearchText(raw);

    const baseFilter: Record<string, unknown> = { isActive: true };
    let docs: ProductDocument[] = [];
    let total = 0;

    // 1) MongoDB text search on corrected query
    try {
      const textFilter = {
        ...baseFilter,
        $text: { $search: searchText },
      };
      const [textDocs, textTotal] = await Promise.all([
        this.productModel
          .find(textFilter, { score: { $meta: 'textScore' } })
          .sort({ score: { $meta: 'textScore' }, soldCount: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .exec(),
        this.productModel.countDocuments(textFilter),
      ]);
      docs = textDocs;
      total = textTotal;
    } catch {
      docs = [];
      total = 0;
    }

    // 2) Fuzzy / substring fallback when text search is weak
    if (total === 0) {
      const tokens = correction.tokens.length
        ? correction.tokens
        : tokenizeSearchQuery(raw);
      const andClauses = tokens.map((token) => {
        const re = new RegExp(escapeRegex(token), 'i');
        return {
          $or: [
            { name: re },
            { brand: re },
            { modelName: re },
            { code: re },
            { searchTags: re },
            { seoKeywords: re },
            { description: re },
          ],
        };
      });

      const fuzzyFilter =
        andClauses.length > 0
          ? { ...baseFilter, $and: andClauses }
          : baseFilter;

      const [fuzzyDocs, fuzzyTotal] = await Promise.all([
        this.productModel
          .find(fuzzyFilter)
          .sort({ soldCount: -1, updatedAt: -1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .exec(),
        this.productModel.countDocuments(fuzzyFilter),
      ]);
      docs = fuzzyDocs;
      total = fuzzyTotal;
    }

    return {
      items: docs.map((doc) => this.productsService.mapProduct(doc)),
      total,
      page,
      limit,
      query: correction.original,
      correctedQuery: correction.wasCorrected ? correction.corrected : null,
      wasCorrected: correction.wasCorrected,
    };
  }

  async suggest(query: SearchSuggestQueryDto) {
    const raw = query.q?.trim() ?? '';
    const limit = query.limit ?? 8;
    if (raw.length < 1) {
      return { suggestions: [] as string[], correctedQuery: null as string | null };
    }

    const vocabulary = await this.getVocabulary();
    const correction = buildCorrectedQuery(raw, vocabulary);
    const needle = correction.corrected || normalizeSearchText(raw);
    const prefix = new RegExp(`^${escapeRegex(needle)}`, 'i');
    const contains = new RegExp(escapeRegex(needle), 'i');

    const suggestions: string[] = [];
    const pushUnique = (value: string) => {
      const trimmed = value.trim();
      if (!trimmed) return;
      if (
        suggestions.some(
          (s) => s.toLowerCase() === trimmed.toLowerCase(),
        )
      ) {
        return;
      }
      suggestions.push(trimmed);
    };

    if (correction.wasCorrected) {
      pushUnique(correction.corrected);
    }

    for (const word of vocabulary) {
      if (prefix.test(word) || contains.test(word)) {
        pushUnique(word);
      }
      if (suggestions.length >= limit) break;
    }

    if (suggestions.length < limit) {
      const docs = await this.productModel
        .find({
          isActive: true,
          $or: [
            { name: contains },
            { brand: contains },
            { searchTags: contains },
          ],
        })
        .select('name brand searchTags')
        .sort({ soldCount: -1 })
        .limit(limit)
        .lean()
        .exec();

      for (const doc of docs) {
        pushUnique(doc.name);
        if (doc.brand) pushUnique(doc.brand);
        for (const tag of doc.searchTags ?? []) pushUnique(tag);
        if (suggestions.length >= limit) break;
      }
    }

    return {
      suggestions: suggestions.slice(0, limit),
      correctedQuery: correction.wasCorrected ? correction.corrected : null,
    };
  }

  async listHistory(
    userId: string | undefined,
    sessionId: string | undefined,
    query: SearchHistoryQueryDto,
  ) {
    const owner = this.resolveOwner(userId, sessionId);
    if (owner.userId && owner.sessionId) {
      await this.mergeGuestIntoUser(owner.userId, owner.sessionId);
    }

    const limit = query.limit ?? 5;
    const offset = query.offset ?? 0;
    const filter = this.ownerFilter(owner);

    const [docs, total] = await Promise.all([
      this.historyModel
        .find(filter)
        .sort({ searchedAt: -1 })
        .skip(offset)
        .limit(limit)
        .exec(),
      this.historyModel.countDocuments(filter),
    ]);

    return {
      items: docs.map((doc) => ({
        query: doc.query,
        correctedQuery: doc.correctedQuery ?? null,
        searchedAt: doc.searchedAt.toISOString(),
      })),
      total,
      limit,
      offset,
      hasMore: offset + docs.length < total,
    };
  }

  async recordHistory(
    userId: string | undefined,
    sessionId: string | undefined,
    dto: RecordSearchHistoryDto,
  ) {
    const owner = this.resolveOwner(userId, sessionId);
    if (owner.userId && owner.sessionId) {
      await this.mergeGuestIntoUser(owner.userId, owner.sessionId);
    }

    const query = dto.query.trim();
    if (!query) throw new BadRequestException('query');

    const queryKey = normalizeSearchText(query);
    if (!queryKey) throw new BadRequestException('query');

    const filter = owner.userId
      ? { userId: owner.userId, queryKey }
      : { sessionId: owner.sessionId, queryKey, userId: { $exists: false } };

    await this.historyModel
      .findOneAndUpdate(
        filter,
        {
          $set: {
            ...(owner.userId
              ? { userId: owner.userId }
              : { sessionId: owner.sessionId }),
            query,
            queryKey,
            correctedQuery: dto.correctedQuery?.trim() || undefined,
            searchedAt: new Date(),
          },
          ...(owner.userId ? { $unset: { sessionId: 1 } } : {}),
        },
        { upsert: true },
      )
      .exec();

    // Trim old entries
    const keepFilter = this.ownerFilter(owner);
    const stale = await this.historyModel
      .find(keepFilter)
      .sort({ searchedAt: -1 })
      .skip(SearchService.HISTORY_KEEP)
      .select('_id')
      .exec();
    if (stale.length) {
      await this.historyModel
        .deleteMany({ _id: { $in: stale.map((d) => d._id) } })
        .exec();
    }

    return { ok: true };
  }

  async deleteHistory(
    userId: string | undefined,
    sessionId: string | undefined,
    rawQuery: string,
  ) {
    const owner = this.resolveOwner(userId, sessionId);
    if (owner.userId && owner.sessionId) {
      await this.mergeGuestIntoUser(owner.userId, owner.sessionId);
    }

    const query = rawQuery?.trim();
    if (!query) throw new BadRequestException('q');

    const queryKey = normalizeSearchText(query);
    if (!queryKey) throw new BadRequestException('q');

    const filter = owner.userId
      ? { userId: owner.userId, queryKey }
      : { sessionId: owner.sessionId, queryKey, userId: { $exists: false } };

    const result = await this.historyModel.deleteOne(filter).exec();
    if (!result.deletedCount) {
      throw new NotFoundException('history');
    }

    return { ok: true };
  }

  async listRecentProducts(
    userId: string | undefined,
    sessionId: string | undefined,
    query: SearchRecentProductsQueryDto,
  ) {
    const owner = this.resolveOwner(userId, sessionId);
    if (owner.userId && owner.sessionId) {
      await this.mergeGuestIntoUser(owner.userId, owner.sessionId);
    }

    const limit = query.limit ?? 10;
    const docs = await this.recentModel
      .find(this.ownerFilter(owner))
      .sort({ viewedAt: -1 })
      .limit(limit)
      .exec();

    const products = await this.mapProductsByIds(
      docs.map((doc) => doc.productId),
    );

    return { items: products, limit };
  }

  async recordRecentProduct(
    userId: string | undefined,
    sessionId: string | undefined,
    dto: RecordRecentProductDto,
  ) {
    const owner = this.resolveOwner(userId, sessionId);
    if (owner.userId && owner.sessionId) {
      await this.mergeGuestIntoUser(owner.userId, owner.sessionId);
    }

    const productId = dto.productId.trim();
    if (!Types.ObjectId.isValid(productId)) {
      throw new BadRequestException('productId');
    }

    const product = await this.productModel
      .findOne({ _id: productId, isActive: true })
      .select('_id')
      .lean()
      .exec();
    if (!product) throw new NotFoundException('Product not found');

    const filter = owner.userId
      ? { userId: owner.userId, productId }
      : {
          sessionId: owner.sessionId,
          productId,
          userId: { $exists: false },
        };

    await this.recentModel
      .findOneAndUpdate(
        filter,
        {
          $set: {
            ...(owner.userId
              ? { userId: owner.userId }
              : { sessionId: owner.sessionId }),
            productId,
            viewedAt: new Date(),
          },
          ...(owner.userId ? { $unset: { sessionId: 1 } } : {}),
        },
        { upsert: true },
      )
      .exec();

    const keepFilter = this.ownerFilter(owner);
    const stale = await this.recentModel
      .find(keepFilter)
      .sort({ viewedAt: -1 })
      .skip(SearchService.RECENT_KEEP)
      .select('_id')
      .exec();
    if (stale.length) {
      await this.recentModel
        .deleteMany({ _id: { $in: stale.map((d) => d._id) } })
        .exec();
    }

    return { ok: true };
  }
}
