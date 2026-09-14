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
import { BrandsService } from './brands.service.js';
import { CreateBrandDto } from './dto/create-brand.dto.js';
import { UpdateBrandDto } from './dto/update-brand.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from '../auth/admin.guard.js';

@Controller('api/brands')
export class BrandsController {
  constructor(private readonly brandsService: BrandsService) {}

  @Get()
  list() {
    return this.brandsService.findAll();
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  adminList() {
    return this.brandsService.findAllAdmin();
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  create(@Body() dto: CreateBrandDto) {
    return this.brandsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(@Param('id') id: string, @Body() dto: UpdateBrandDto) {
    return this.brandsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  remove(@Param('id') id: string) {
    return this.brandsService.remove(id);
  }
}
