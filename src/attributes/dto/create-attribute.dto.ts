import { IsIn, IsString } from 'class-validator';
import { ATTRIBUTE_UNITS } from '../attribute-units.js';

export class CreateAttributeDto {
  @IsString()
  name!: string;

  @IsString()
  value!: string;

  @IsIn(ATTRIBUTE_UNITS)
  unit!: string;
}
