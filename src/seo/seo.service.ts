import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '../cache/cache.module.js';
import { SeoIntent, SeoTemplate, SeoTemplateDocument } from './seo-template.schema.js';
import { Product, ProductDocument } from '../products/product.schema.js';
import { Category, CategoryDocument } from '../categories/category.schema.js';

type TemplateVars = Record<string, string | number | undefined>;

const DEFAULT_TEMPLATES: Array<{
  key: string;
  intent: SeoIntent;
  titleTemplate: string;
  descriptionTemplate: string;
  h1Template: string;
  keywordTemplates: string[];
  exampleQueries: string[];
  matchPatterns: string[];
}> = [
  {
    key: 'newest_brand_model',
    intent: SeoIntent.NEWEST,
    titleTemplate: '{brand} {model} yangisi — {year} | {siteName}',
    descriptionTemplate:
      '{brand} {model} yangi modelini {siteName} dan xarid qiling. Rasmiy kafolat, tez yetkazib berish.',
    h1Template: '{brand} {model} yangisi',
    keywordTemplates: [
      '{brand} {model} yangisi',
      '{brand} {model} new',
      'yangi {brand} {model}',
    ],
    exampleQueries: ['Macbook M4 yangisi', 'iPhone 16 yangisi', 'Samsung S25 yangisi'],
    matchPatterns: ['yangisi', 'yangi', 'new', 'latest', 'eng yangi'],
  },
  {
    key: 'cheapest_category',
    intent: SeoIntent.CHEAPEST,
    titleTemplate: 'Eng arzon {category} — {minPrice} soʻmdan | {siteName}',
    descriptionTemplate:
      'Eng arzon {category} modellarini taqqoslang. Narxi {minPrice} soʻmdan boshlanadi. Tez yetkazib berish.',
    h1Template: 'Eng arzon {category}',
    keywordTemplates: [
      'eng arzon {category}',
      'arzon {category}',
      '{category} narxlari',
      'cheap {category}',
    ],
    exampleQueries: ['eng arzon noutbuk', 'eng arzon telefon', 'arzon planshet'],
    matchPatterns: ['eng arzon', 'arzon', 'cheap', 'budget', 'narxi past'],
  },
  {
    key: 'bestseller_category',
    intent: SeoIntent.BESTSELLER,
    titleTemplate: 'Eng koʻp sotilgan {category} | {siteName}',
    descriptionTemplate:
      'Mijozlar eng koʻp tanlagan {category} mahsulotlari. Reyting va narx boʻyicha saralangan.',
    h1Template: 'Eng koʻp sotilgan {category}',
    keywordTemplates: ['eng koʻp sotilgan {category}', 'best {category}', 'top {category}'],
    exampleQueries: ['eng koʻp sotilgan noutbuk', 'top telefonlar'],
    matchPatterns: ['eng koʻp sotilgan', 'bestseller', 'top', 'mashhur'],
  },
  {
    key: 'brand_model',
    intent: SeoIntent.BRAND_MODEL,
    titleTemplate: '{brand} {model} narxi va xususiyatlari | {siteName}',
    descriptionTemplate:
      '{brand} {model} — narx, texnik xususiyatlar, omborda borligi va yetkazib berish {siteName} da.',
    h1Template: '{brand} {model}',
    keywordTemplates: [
      '{brand} {model}',
      '{brand} {model} narxi',
      '{brand} {model} sotib olish',
    ],
    exampleQueries: ['MacBook M4', 'iPhone 16 Pro', 'Xiaomi 14'],
    matchPatterns: [],
  },
  {
    key: 'category_hub',
    intent: SeoIntent.CATEGORY,
    titleTemplate: '{category} — katalog va narxlar | {siteName}',
    descriptionTemplate:
      '{category} katalogi: filterlar, arzon variantlar va yangi kelganlar. {siteName} onlayn doʻkoni.',
    h1Template: '{category}',
    keywordTemplates: ['{category}', '{category} katalog', '{category} sotib olish'],
    exampleQueries: ['noutbuk', 'telefon', 'monitor'],
    matchPatterns: [],
  },
  {
    key: 'comparison',
    intent: SeoIntent.COMPARISON,
    titleTemplate: '{left} vs {right} — qaysi biri yaxshiroq? | {siteName}',
    descriptionTemplate:
      '{left} va {right} ni taqqoslang: narx, xotira, tezlik va kafolat. {siteName} yordamida tanlang.',
    h1Template: '{left} vs {right}',
    keywordTemplates: ['{left} vs {right}', '{left} yoki {right}'],
    exampleQueries: ['MacBook Air vs Pro', 'iPhone vs Samsung'],
    matchPatterns: ['vs', 'yoki', 'taqqoslash', 'farqi'],
  },
  {
    key: 'generic_search',
    intent: SeoIntent.GENERIC_SEARCH,
    titleTemplate: '«{query}» boʻyicha natijalar | {siteName}',
    descriptionTemplate:
      '«{query}» qidiruvi boʻyicha mahsulotlar. Narx, ombor va yetkazib berish maʼlumotlari.',
    h1Template: 'Qidiruv: {query}',
    keywordTemplates: ['{query}'],
    exampleQueries: ['m4 noutbuk', 'gaming laptop'],
    matchPatterns: [],
  },
];

@Injectable()
export class SeoService implements OnModuleInit {
  private readonly logger = new Logger(SeoService.name);

  constructor(
    @InjectModel(SeoTemplate.name)
    private readonly templateModel: Model<SeoTemplateDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    private readonly cache: CacheService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.seedTemplates();
  }

  private applyTemplate(template: string, vars: TemplateVars): string {
    return template.replace(/\{(\w+)\}/g, (_, key: string) => {
      const value = vars[key];
      return value === undefined || value === null ? '' : String(value);
    }).replace(/\s+/g, ' ').trim();
  }

  private async seedTemplates() {
    for (const template of DEFAULT_TEMPLATES) {
      await this.templateModel.updateOne(
        { key: template.key },
        { $setOnInsert: template },
        { upsert: true },
      );
    }
    this.logger.log(`SEO templates ready (${DEFAULT_TEMPLATES.length})`);
  }

  async listTemplates() {
    return this.templateModel.find({ isActive: true }).lean();
  }

  detectIntent(query: string): SeoIntent {
    const q = query.toLowerCase();

    if (DEFAULT_TEMPLATES.find((t) => t.intent === SeoIntent.COMPARISON)?.matchPatterns.some((p) => q.includes(p))) {
      return SeoIntent.COMPARISON;
    }
    if (DEFAULT_TEMPLATES.find((t) => t.intent === SeoIntent.CHEAPEST)?.matchPatterns.some((p) => q.includes(p))) {
      return SeoIntent.CHEAPEST;
    }
    if (DEFAULT_TEMPLATES.find((t) => t.intent === SeoIntent.NEWEST)?.matchPatterns.some((p) => q.includes(p))) {
      return SeoIntent.NEWEST;
    }
    if (DEFAULT_TEMPLATES.find((t) => t.intent === SeoIntent.BESTSELLER)?.matchPatterns.some((p) => q.includes(p))) {
      return SeoIntent.BESTSELLER;
    }
    return SeoIntent.GENERIC_SEARCH;
  }

  async resolveSearchSeo(query: string) {
    const cacheKey = `seo:search:${query.toLowerCase()}`;
    const cached = await this.cache.get<unknown>(cacheKey);
    if (cached) return cached;

    const intent = this.detectIntent(query);
    const template =
      (await this.templateModel.findOne({ intent, isActive: true }).lean()) ??
      (await this.templateModel.findOne({ key: 'generic_search' }).lean());

    const siteName = 'Kalibri Texnika';
    const year = new Date().getFullYear();

    // Heuristic entity extraction for brand/model/category tokens
    const tokens = query.replace(/yangisi|eng arzon|arzon|yangi|new|latest/gi, '').trim();
    const categoryGuess =
      (await this.categoryModel
        .findOne({ $text: { $search: tokens || query } })
        .select('name slug')
        .lean()) ?? null;

    const cheapest = await this.productModel
      .findOne({
        isActive: true,
        ...(categoryGuess ? { categorySlug: categoryGuess.slug } : {}),
      })
      .sort({ 'price.amount': 1 })
      .select('price brand modelName name categorySlug')
      .lean();

    const vars: TemplateVars = {
      siteName,
      year,
      query,
      category: categoryGuess?.name ?? (tokens || 'mahsulotlar'),
      brand: cheapest?.brand ?? tokens.split(/\s+/)[0] ?? '',
      model: cheapest?.modelName ?? tokens.split(/\s+/).slice(1).join(' ') ?? '',
      minPrice: cheapest?.price?.amount ?? '',
      left: tokens.split(/\s+vs\s+/i)[0]?.trim() ?? '',
      right: tokens.split(/\s+vs\s+/i)[1]?.trim() ?? '',
    };

    const payload = {
      query,
      intent,
      templateKey: template?.key,
      title: this.applyTemplate(template?.titleTemplate ?? '{query} | {siteName}', vars),
      description: this.applyTemplate(
        template?.descriptionTemplate ?? '{query} — {siteName}',
        vars,
      ),
      h1: this.applyTemplate(template?.h1Template ?? '{query}', vars),
      keywords: (template?.keywordTemplates ?? ['{query}']).map((k) =>
        this.applyTemplate(k, vars),
      ),
      suggestedSort:
        intent === SeoIntent.CHEAPEST
          ? 'price_asc'
          : intent === SeoIntent.NEWEST
            ? 'newest'
            : intent === SeoIntent.BESTSELLER
              ? 'bestseller'
              : 'relevance',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'SearchResultsPage',
        name: this.applyTemplate(template?.h1Template ?? '{query}', vars),
        description: this.applyTemplate(
          template?.descriptionTemplate ?? '{query}',
          vars,
        ),
      },
      examples: template?.exampleQueries ?? [],
    };

    await this.cache.set(cacheKey, payload, this.config.get<number>('cacheTtlSeconds') ?? 60);
    return payload;
  }

  async productSeo(slug: string) {
    const cacheKey = `seo:product:${slug}`;
    const cached = await this.cache.get<unknown>(cacheKey);
    if (cached) return cached;

    const product = await this.productModel.findOne({ slug, isActive: true }).lean();
    if (!product) return null;

    const siteUrl = this.config.get<string>('siteUrl') ?? 'http://localhost:3000';
    const siteName = 'Kalibri Texnika';
    const template = await this.templateModel.findOne({ key: 'brand_model' }).lean();

    const vars: TemplateVars = {
      siteName,
      brand: product.brand ?? '',
      model: product.modelName ?? product.name,
      category: product.categorySlug ?? '',
      query: product.name,
    };

    const title =
      product.seoTitle ??
      this.applyTemplate(template?.titleTemplate ?? '{brand} {model} | {siteName}', vars);
    const description =
      product.seoDescription ??
      this.applyTemplate(
        template?.descriptionTemplate ?? '{brand} {model} — {siteName}',
        vars,
      );

    const payload = {
      slug: product.slug,
      title,
      description,
      keywords: product.seoKeywords?.length
        ? product.seoKeywords
        : [product.name, product.brand, product.modelName].filter(Boolean),
      canonical: `${siteUrl}/products/${product.slug}`,
      openGraph: {
        title,
        description,
        url: `${siteUrl}/products/${product.slug}`,
        images: product.imageUrl ? [product.imageUrl] : [],
        type: 'product',
      },
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.description ?? description,
        image: product.imageUrl ? [product.imageUrl] : [],
        sku: String(product._id),
        brand: product.brand
          ? { '@type': 'Brand', name: product.brand }
          : { '@type': 'Brand', name: siteName },
        offers: {
          '@type': 'Offer',
          url: `${siteUrl}/products/${product.slug}`,
          priceCurrency: product.price.currency,
          price: product.price.amount,
          availability: product.inStock
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        },
      },
    };

    await this.cache.set(cacheKey, payload, this.config.get<number>('cacheTtlSeconds') ?? 60);
    return payload;
  }

  async sitemapPayload() {
    const cacheKey = 'seo:sitemap';
    const cached = await this.cache.get<unknown>(cacheKey);
    if (cached) return cached;

    const siteUrl = this.config.get<string>('siteUrl') ?? 'http://localhost:3000';
    const [products, categories] = await Promise.all([
      this.productModel
        .find({ isActive: true })
        .select('slug updatedAt')
        .sort({ updatedAt: -1 })
        .limit(50000)
        .lean(),
      this.categoryModel.find({ isActive: true }).select('slug updatedAt').lean(),
    ]);

    const payload = {
      baseUrl: siteUrl,
      urls: [
        { loc: `${siteUrl}/`, changefreq: 'daily', priority: 1 },
        { loc: `${siteUrl}/products`, changefreq: 'daily', priority: 0.9 },
        ...categories.map((c) => ({
          loc: `${siteUrl}/categories/${c.slug}`,
          lastmod: (c as { updatedAt?: Date }).updatedAt,
          changefreq: 'daily' as const,
          priority: 0.8,
        })),
        ...products.map((p) => ({
          loc: `${siteUrl}/products/${p.slug}`,
          lastmod: (p as { updatedAt?: Date }).updatedAt,
          changefreq: 'daily' as const,
          priority: 0.7,
        })),
      ],
    };

    await this.cache.set(cacheKey, payload, 300);
    return payload;
  }
}
