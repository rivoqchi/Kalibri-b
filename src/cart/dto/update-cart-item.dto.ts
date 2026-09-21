import { IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class UpdateCartItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  quantity!: number;
}
