import { Controller, Get, Param, Query } from '@nestjs/common';
import { SeoService } from './seo.service.js';

@Controller('api/seo')
export class SeoController {
  constructor(private readonly seoService: SeoService) {}

  @Get('templates')
  templates() {
    return this.seoService.listTemplates();
  }

  @Get('search')
  search(@Query('q') q = '') {
    return this.seoService.resolveSearchSeo(q.trim() || 'mahsulotlar');
  }

  @Get('product/:slug')
  product(@Param('slug') slug: string) {
    return this.seoService.productSeo(slug);
  }

  @Get('sitemap')
  sitemap() {
    return this.seoService.sitemapPayload();
  }
}
