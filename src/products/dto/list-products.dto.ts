import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { Transform, Type } from 'class-transformer';

function parseIds(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = Array.isArray(value) ? value : String(value).split(',');
  const ids = raw
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0);
  return ids.length > 0 ? ids : undefined;
}

export class ListProductsQueryDto {
  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsString()
  category?: string;

  /** Product direction (admin "Maxsulot yo'nalishi") id — filters by linked productIds. */
  @IsOptional()
  @IsMongoId()
  direction?: string;

  @IsOptional()
  @IsString()
  brand?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  minPrice?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  maxPrice?: number;

  @IsOptional()
  @IsString()
  sort?: 'price_asc' | 'price_desc' | 'newest' | 'bestseller' | 'relevance';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 24;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  inStock?: boolean;

  /** Exclude a product id from results (e.g. related products on detail page). */
  @IsOptional()
  @IsMongoId()
  excludeId?: string;

  /** Resolve specific active products by id (favorites). Order preserved. */
  @IsOptional()
  @Transform(({ value }) => parseIds(value))
  @IsArray()
  @ArrayMaxSize(100)
  @IsMongoId({ each: true })
  ids?: string[];
}
