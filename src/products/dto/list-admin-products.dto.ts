import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsMongoId,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

function parseIds(value: unknown): string[] | undefined {
  if (value === undefined || value === null || value === '') return undefined;
  const raw = Array.isArray(value) ? value : String(value).split(',');
  const ids = raw
    .map((item) => String(item).trim())
    .filter((item) => item.length > 0);
  return ids.length > 0 ? ids : undefined;
}

export class ListAdminProductsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit?: number = 30;

  @IsOptional()
  @Transform(({ value }) => parseIds(value))
  @IsArray()
  @ArrayMaxSize(200)
  @IsMongoId({ each: true })
  ids?: string[];
}
