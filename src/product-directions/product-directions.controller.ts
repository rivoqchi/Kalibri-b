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
import { ProductDirectionsService } from './product-directions.service.js';
import { CreateProductDirectionDto } from './dto/create-product-direction.dto.js';
import { UpdateProductDirectionDto } from './dto/update-product-direction.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from '../auth/admin.guard.js';

@Controller('api/product-directions')
export class ProductDirectionsController {
  constructor(
    private readonly productDirectionsService: ProductDirectionsService,
  ) {}

  @Get()
  list() {
    return this.productDirectionsService.findAll();
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  adminList() {
    return this.productDirectionsService.findAllAdmin();
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  create(@Body() dto: CreateProductDirectionDto) {
    return this.productDirectionsService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(@Param('id') id: string, @Body() dto: UpdateProductDirectionDto) {
    return this.productDirectionsService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  remove(@Param('id') id: string) {
    return this.productDirectionsService.remove(id);
  }
}
