import { IsString, MinLength } from 'class-validator';

export class VerifyTelegramWebAppDto {
  @IsString()
  @MinLength(10)
  initData!: string;
}
