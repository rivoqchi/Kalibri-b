import { IsString, Length, Matches } from 'class-validator';

export class VerifyTelegramCodeDto {
  @IsString()
  @Length(4, 4)
  @Matches(/^\d{4}$/)
  code!: string;
}
