import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class CreateCheckoutDto {
  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsString()
  phone!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  address!: string;

  @IsOptional()
  @IsString()
  note?: string;
}
