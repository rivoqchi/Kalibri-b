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
import { CategoriesService } from './categories.service.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from '../auth/admin.guard.js';

@Controller('api/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  list() {
    return this.categoriesService.findAll();
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  adminList() {
    return this.categoriesService.findAllAdmin();
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  remove(@Param('id') id: string) {
    return this.categoriesService.remove(id);
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.categoriesService.findBySlug(slug);
  }
}
