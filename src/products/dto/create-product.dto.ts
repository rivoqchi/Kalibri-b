import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class MoneyDto {
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsString()
  currency!: string;
}

export class CreateProductDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @ValidateNested()
  @Type(() => MoneyDto)
  price!: MoneyDto;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imageUrls?: string[];

  @IsOptional()
  @IsString()
  categorySlug?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @IsString()
  modelName?: string;

  @IsOptional()
  @IsBoolean()
  inStock?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stockQty?: number;

  @IsOptional()
  @IsBoolean()
  isNewArrival?: boolean;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  searchTags?: string[];

  @IsOptional()
  @IsString()
  seoTitle?: string;

  @IsOptional()
  @IsString()
  seoDescription?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  seoKeywords?: string[];
}
