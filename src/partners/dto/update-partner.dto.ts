import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class PartnerMonthDto {
  @IsNumber()
  @Min(1)
  month!: number;

  @IsNumber()
  @Min(0)
  percent!: number;
}

export class UpdatePartnerDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PartnerMonthDto)
  @ArrayUnique((item: PartnerMonthDto) => item.month)
  months?: PartnerMonthDto[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
