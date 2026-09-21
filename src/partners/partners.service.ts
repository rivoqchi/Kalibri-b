import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Partner, PartnerDocument } from './partner.schema.js';
import { CreatePartnerDto } from './dto/create-partner.dto.js';
import { UpdatePartnerDto } from './dto/update-partner.dto.js';

@Injectable()
export class PartnersService {
  constructor(
    @InjectModel(Partner.name)
    private readonly partnerModel: Model<PartnerDocument>,
  ) {}

  private map(doc: PartnerDocument) {
    return {
      id: String(doc._id),
      name: doc.name,
      imageUrl: doc.imageUrl,
      phone: doc.phone ?? '',
      months: (doc.months ?? []).map((item) => ({
        month: item.month,
        percent: item.percent,
      })),
      isActive: doc.isActive,
    };
  }

  private normalizeMonths(
    months: { month: number; percent: number }[] | undefined,
  ) {
    if (!months) return [];
    return [...months]
      .map((item) => ({
        month: Number(item.month),
        percent: Number(item.percent),
      }))
      .sort((a, b) => a.month - b.month);
  }

  async create(dto: CreatePartnerDto) {
    const created = await this.partnerModel.create({
      name: dto.name.trim(),
      imageUrl: dto.imageUrl.trim(),
      phone: (dto.phone ?? '').trim(),
      months: this.normalizeMonths(dto.months),
      isActive: dto.isActive ?? true,
    });
    return this.map(created);
  }

  async findById(id: string) {
    const doc = await this.partnerModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Partner');
    return this.map(doc);
  }

  async findAll() {
    const docs = await this.partnerModel
      .find({ isActive: true })
      .sort({ name: 1 })
      .exec();
    return docs.map((doc) => this.map(doc));
  }

  async findAllAdmin() {
    const docs = await this.partnerModel.find().sort({ name: 1 }).exec();
    return docs.map((doc) => this.map(doc));
  }

  async update(id: string, dto: UpdatePartnerDto) {
    const doc = await this.partnerModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Partner');

    if (dto.name !== undefined) doc.name = dto.name.trim();
    if (dto.imageUrl !== undefined) doc.imageUrl = dto.imageUrl.trim();
    if (dto.phone !== undefined) doc.phone = dto.phone.trim();
    if (dto.months !== undefined) doc.months = this.normalizeMonths(dto.months);
    if (dto.isActive !== undefined) doc.isActive = dto.isActive;

    await doc.save();
    return this.map(doc);
  }

  async remove(id: string) {
    const doc = await this.partnerModel.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('Partner');
    return { ok: true, id };
  }
}
