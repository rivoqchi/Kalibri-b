import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { HomeAd, HomeAdDocument } from './home-ad.schema.js';
import { CreateHomeAdDto } from './dto/create-home-ad.dto.js';
import { UpdateHomeAdDto } from './dto/update-home-ad.dto.js';

@Injectable()
export class HomeAdsService {
  constructor(
    @InjectModel(HomeAd.name)
    private readonly homeAdModel: Model<HomeAdDocument>,
  ) {}

  private map(doc: HomeAdDocument) {
    return {
      id: String(doc._id),
      name: doc.name,
      imageUrl: doc.imageUrl,
      link: doc.link,
      isActive: doc.isActive,
    };
  }

  async create(dto: CreateHomeAdDto) {
    const created = await this.homeAdModel.create({
      name: dto.name.trim(),
      imageUrl: dto.imageUrl.trim(),
      link: dto.link.trim(),
    });
    return this.map(created);
  }

  async findAll() {
    const docs = await this.homeAdModel
      .find({ isActive: true })
      .sort({ createdAt: -1 })
      .exec();
    return docs.map((doc) => this.map(doc));
  }

  async findAllAdmin() {
    const docs = await this.homeAdModel.find().sort({ createdAt: -1 }).exec();
    return docs.map((doc) => this.map(doc));
  }

  async update(id: string, dto: UpdateHomeAdDto) {
    const doc = await this.homeAdModel.findById(id).exec();
    if (!doc) throw new NotFoundException('HomeAd');

    if (dto.name !== undefined) doc.name = dto.name.trim();
    if (dto.imageUrl !== undefined) doc.imageUrl = dto.imageUrl.trim();
    if (dto.link !== undefined) doc.link = dto.link.trim();
    if (dto.isActive !== undefined) doc.isActive = dto.isActive;

    await doc.save();
    return this.map(doc);
  }

  async remove(id: string) {
    const doc = await this.homeAdModel.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('HomeAd');
    return { ok: true, id };
  }
}
