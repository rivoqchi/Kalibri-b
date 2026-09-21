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
import { ProductServicesService } from './product-services.service.js';
import { CreateProductServiceDto } from './dto/create-product-service.dto.js';
import { UpdateProductServiceDto } from './dto/update-product-service.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from '../auth/admin.guard.js';

@Controller('api/product-services')
export class ProductServicesController {
  constructor(
    private readonly productServicesService: ProductServicesService,
  ) {}

  @Get()
  list() {
    return this.productServicesService.findAll();
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  adminList() {
    return this.productServicesService.findAllAdmin();
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  create(@Body() dto: CreateProductServiceDto) {
    return this.productServicesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(@Param('id') id: string, @Body() dto: UpdateProductServiceDto) {
    return this.productServicesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  remove(@Param('id') id: string) {
    return this.productServicesService.remove(id);
  }
}
