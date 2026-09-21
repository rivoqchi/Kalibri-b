import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

class OrderMoneyDto {
  @IsNumber()
  @Min(0)
  amount!: number;

  @IsString()
  @MinLength(1)
  currency!: string;
}

class CreateOrderItemDto {
  @IsString()
  @MinLength(1)
  productId!: string;

  @IsString()
  @MinLength(1)
  slug!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsInt()
  @Min(1)
  quantity!: number;

  @ValidateNested()
  @Type(() => OrderMoneyDto)
  unitPrice!: OrderMoneyDto;

  @IsOptional()
  @IsString()
  imageUrl?: string;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsString()
  @MinLength(1)
  partnerId!: string;

  @IsInt()
  @Min(1)
  months!: number;
}
