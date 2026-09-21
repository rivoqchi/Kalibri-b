import { IsString } from 'class-validator';

export class CreateHomeAdDto {
  @IsString()
  name!: string;

  @IsString()
  imageUrl!: string;

  @IsString()
  link!: string;
}
