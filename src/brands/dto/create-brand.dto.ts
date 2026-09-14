import { IsOptional, IsString } from 'class-validator';

export class CreateBrandDto {
  @IsString()
  name!: string;

  @IsString()
  imageUrl!: string;

  @IsOptional()
  @IsString()
  slug?: string;
}
