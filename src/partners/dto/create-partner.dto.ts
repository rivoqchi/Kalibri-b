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

export class PartnerMonthDto {
  @IsNumber()
  @Min(1)
  month!: number;

  @IsNumber()
  @Min(0)
  percent!: number;
}

export class CreatePartnerDto {
  @IsString()
  name!: string;

  @IsString()
  imageUrl!: string;

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
