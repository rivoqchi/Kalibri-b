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
import { AttributesService } from './attributes.service.js';
import { CreateAttributeDto } from './dto/create-attribute.dto.js';
import { UpdateAttributeDto } from './dto/update-attribute.dto.js';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { AdminGuard } from '../auth/admin.guard.js';

@Controller('api/attributes')
export class AttributesController {
  constructor(private readonly attributesService: AttributesService) {}

  @Get()
  list() {
    return this.attributesService.findAll();
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, AdminGuard)
  adminList() {
    return this.attributesService.findAllAdmin();
  }

  @Post()
  @UseGuards(JwtAuthGuard, AdminGuard)
  create(@Body() dto: CreateAttributeDto) {
    return this.attributesService.create(dto);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(@Param('id') id: string, @Body() dto: UpdateAttributeDto) {
    return this.attributesService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard, AdminGuard)
  remove(@Param('id') id: string) {
    return this.attributesService.remove(id);
  }
}
