import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateHomeAdDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  imageUrl?: string;

  @IsOptional()
  @IsString()
  link?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
