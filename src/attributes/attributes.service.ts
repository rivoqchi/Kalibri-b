import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Attribute, AttributeDocument } from './attribute.schema.js';
import { CreateAttributeDto } from './dto/create-attribute.dto.js';
import { UpdateAttributeDto } from './dto/update-attribute.dto.js';
import { toSlug } from '../common/utils/slug.js';

@Injectable()
export class AttributesService {
  constructor(
    @InjectModel(Attribute.name)
    private readonly attributeModel: Model<AttributeDocument>,
  ) {}

  private map(doc: AttributeDocument) {
    return {
      id: String(doc._id),
      name: doc.name,
      value: doc.value,
      slug: doc.slug,
      isActive: doc.isActive,
    };
  }

  private makeSlug(name: string, value: string) {
    return toSlug(`${name}-${value}`);
  }

  async create(dto: CreateAttributeDto) {
    const name = dto.name.trim();
    const value = dto.value.trim();
    const slug = this.makeSlug(name, value);
    try {
      const created = await this.attributeModel.create({
        name,
        value,
        slug,
      });
      return this.map(created);
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('Attribute');
      }
      throw error;
    }
  }

  async findAll() {
    const docs = await this.attributeModel
      .find({ isActive: true })
      .sort({ name: 1, value: 1 })
      .exec();
    return docs.map((doc) => this.map(doc));
  }

  async findAllAdmin() {
    const docs = await this.attributeModel
      .find()
      .sort({ name: 1, value: 1 })
      .exec();
    return docs.map((doc) => this.map(doc));
  }

  async update(id: string, dto: UpdateAttributeDto) {
    const doc = await this.attributeModel.findById(id).exec();
    if (!doc) throw new NotFoundException('Attribute');

    if (dto.name !== undefined) doc.name = dto.name.trim();
    if (dto.value !== undefined) doc.value = dto.value.trim();
    doc.slug = this.makeSlug(doc.name, doc.value);

    try {
      await doc.save();
    } catch (error) {
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('Attribute');
      }
      throw error;
    }

    return this.map(doc);
  }

  async remove(id: string) {
    const doc = await this.attributeModel.findByIdAndDelete(id).exec();
    if (!doc) throw new NotFoundException('Attribute');
    return { ok: true, id };
  }
}
