import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class CreateBrandDto {
  @IsString()
  name!: string;

  @IsString()
  imageUrl!: string;

  @IsOptional()
  @IsString()
  slug?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
