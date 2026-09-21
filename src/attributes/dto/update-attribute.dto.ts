import { IsBoolean, IsIn, IsOptional, IsString } from 'class-validator';
import { ATTRIBUTE_UNITS } from '../attribute-units.js';

export class UpdateAttributeDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  value?: string;

  @IsOptional()
  @IsIn(ATTRIBUTE_UNITS)
  unit?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
