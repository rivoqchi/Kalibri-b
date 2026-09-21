import { IsString } from 'class-validator';

export class AddFavoriteItemDto {
  @IsString()
  productId!: string;
}
