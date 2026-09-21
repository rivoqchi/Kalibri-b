import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ListProductsQueryDto } from './dto/list-products.dto.js';
import { ListAdminProductsQueryDto } from './dto/list-admin-products.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from '../auth/admin.guard.js';

@Controller('api/products')
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  @Get()
  list(@Query() query: ListProductsQueryDto) {
    return this.productsService.findAll(query);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  adminList(@Query() query: ListAdminProductsQueryDto) {
    return this.productsService.findAllAdmin(query);
  }

  @Get('price-range')
  priceRange() {
    return this.productsService.getPriceRange();
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  create(@Body() dto: CreateProductDto) {
    return this.productsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.productsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  remove(@Param('id') id: string) {
    return this.productsService.remove(id);
  }

  @Get(':slug')
  bySlug(@Param('slug') slug: string) {
    return this.productsService.findBySlug(slug);
  }
}
