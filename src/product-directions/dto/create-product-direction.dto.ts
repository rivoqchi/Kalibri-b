import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsMongoId,
  IsOptional,
  IsString,
} from 'class-validator';

export class CreateProductDirectionDto {
  @IsString()
  name!: string;

  @IsString()
  imageUrl!: string;

  @IsOptional()
  @IsArray()
  @IsMongoId({ each: true })
  @ArrayUnique()
  productIds?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
