import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateProductServiceDto {
  @IsString()
  name!: string;

  @IsString()
  imageUrl!: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
