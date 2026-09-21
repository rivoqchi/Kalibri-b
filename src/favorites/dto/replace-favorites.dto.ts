import { IsArray, IsString } from 'class-validator';

export class ReplaceFavoritesDto {
  @IsArray()
  @IsString({ each: true })
  productIds!: string[];
}
