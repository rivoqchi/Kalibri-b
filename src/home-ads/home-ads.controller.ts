import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { HomeAdsService } from './home-ads.service.js';
import { CreateHomeAdDto } from './dto/create-home-ad.dto.js';
import { UpdateHomeAdDto } from './dto/update-home-ad.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from '../auth/admin.guard.js';

@Controller('api/home-ads')
export class HomeAdsController {
  constructor(private readonly homeAdsService: HomeAdsService) {}

  @Get()
  list() {
    return this.homeAdsService.findAll();
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  adminList() {
    return this.homeAdsService.findAllAdmin();
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  create(@Body() dto: CreateHomeAdDto) {
    return this.homeAdsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(@Param('id') id: string, @Body() dto: UpdateHomeAdDto) {
    return this.homeAdsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  remove(@Param('id') id: string) {
    return this.homeAdsService.remove(id);
  }
}
