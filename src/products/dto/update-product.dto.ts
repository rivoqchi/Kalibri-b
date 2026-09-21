import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PRODUCT_STATUS_TAGS } from '../product-status.constants.js';

class MoneyDto {
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsString()
  currency!: string;
}

export class UpdateProductDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => MoneyDto)
  price?: MoneyDto;

  @IsOptional()
  @ValidateIf((_: UpdateProductDto, value: unknown) => value !== null)
  @ValidateNested()
  @Type(() => MoneyDto)
  salePrice?: MoneyDto | null;

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

  /** cheksiz — when true, stockQty is ignored */
  @IsOptional()
  @IsBoolean()
  stockUnlimited?: boolean;

  @IsOptional()
  @IsBoolean()
  inStock?: boolean;

  @ValidateIf((o: UpdateProductDto) => o.stockUnlimited === false)
  @IsInt()
  @Min(0)
  stockQty?: number;

  @IsOptional()
  @IsBoolean()
  isNewArrival?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  attributeIds?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @IsIn([...PRODUCT_STATUS_TAGS], { each: true })
  statusTags?: string[];

  @ValidateIf(
    (o: UpdateProductDto) =>
      o.statusTags !== undefined && o.statusTags.includes('seasonal'),
  )
  @IsOptional()
  @IsInt()
  @Min(1)
  seasonalDays?: number;

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
