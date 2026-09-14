import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Category, CategoryDocument } from '../categories/category.schema.js';
import { Product, ProductDocument } from '../products/product.schema.js';

@Injectable()
export class SeedService implements OnModuleInit {
  private readonly logger = new Logger(SeedService.name);

  constructor(
    @InjectModel(Category.name) private readonly categoryModel: Model<CategoryDocument>,
    @InjectModel(Product.name) private readonly productModel: Model<ProductDocument>,
  ) {}

  async onModuleInit() {
    const count = await this.productModel.estimatedDocumentCount();
    if (count > 0) return;

    this.logger.log('Seeding demo catalog for development...');

    const [laptops, phones] = await this.categoryModel.create([
      {
        name: 'Noutbuklar',
        slug: 'noutbuklar',
        description: 'MacBook, gaming va ofis noutbuklari',
        seoTitle: 'Noutbuklar katalogi | Kalibri Texnika',
        seoDescription: 'Eng yangi va eng arzon noutbuklar.',
        seoKeywords: ['noutbuk', 'laptop', 'macbook'],
      },
      {
        name: 'Telefonlar',
        slug: 'telefonlar',
        description: 'Smartfonlar',
        seoTitle: 'Telefonlar | Kalibri Texnika',
        seoDescription: 'Eng arzon va yangi telefonlar.',
        seoKeywords: ['telefon', 'smartphone'],
      },
    ]);

    await this.productModel.create([
      {
        name: 'Apple MacBook Pro M4',
        slug: 'apple-macbook-pro-m4',
        description: 'Yangi MacBook Pro M4 — professional ish yuklari uchun.',
        price: { amount: 28_500_000, currency: 'UZS' },
        brand: 'Apple',
        modelName: 'MacBook Pro M4',
        categoryId: laptops._id,
        categorySlug: 'noutbuklar',
        inStock: true,
        stockQty: 12,
        isNewArrival: true,
        soldCount: 40,
        searchTags: ['macbook m4 yangisi', 'apple laptop', 'm4 pro'],
        seoTitle: 'MacBook Pro M4 yangisi — narxi | Kalibri Texnika',
        seoDescription: 'MacBook M4 yangisini Kalibri Texnika dan sotib oling.',
        seoKeywords: ['Macbook M4 yangisi', 'MacBook Pro M4', 'Apple noutbuk'],
        imageUrl: 'https://imagedelivery.net/placeholder/macbook-m4',
      },
      {
        name: 'Budget Office Laptop 15',
        slug: 'budget-office-laptop-15',
        description: 'Kundalik ishlar uchun eng arzon noutbuk.',
        price: { amount: 4_200_000, currency: 'UZS' },
        brand: 'Kalibri',
        modelName: 'Office 15',
        categoryId: laptops._id,
        categorySlug: 'noutbuklar',
        inStock: true,
        stockQty: 50,
        isNewArrival: false,
        soldCount: 210,
        searchTags: ['eng arzon noutbuk', 'budget laptop', 'arzon noutbuk'],
        seoTitle: 'Eng arzon noutbuk — Office 15 | Kalibri Texnika',
        seoDescription: 'Eng arzon noutbuk variantlari va narxlari.',
        seoKeywords: ['eng arzon noutbuk', 'arzon laptop'],
        imageUrl: 'https://imagedelivery.net/placeholder/budget-laptop',
      },
      {
        name: 'Samsung Galaxy S25',
        slug: 'samsung-galaxy-s25',
        description: 'Yangi flagman smartfon.',
        price: { amount: 12_900_000, currency: 'UZS' },
        brand: 'Samsung',
        modelName: 'Galaxy S25',
        categoryId: phones._id,
        categorySlug: 'telefonlar',
        inStock: true,
        stockQty: 30,
        isNewArrival: true,
        soldCount: 95,
        searchTags: ['samsung s25 yangisi', 'flagman telefon'],
        seoKeywords: ['Samsung S25 yangisi', 'Galaxy S25'],
        imageUrl: 'https://imagedelivery.net/placeholder/s25',
      },
    ]);

    this.logger.log('Demo catalog seeded');
  }
}
