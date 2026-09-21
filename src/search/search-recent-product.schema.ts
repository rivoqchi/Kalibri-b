import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SearchRecentProductDocument = HydratedDocument<SearchRecentProduct>;

@Schema({ timestamps: true, collection: 'search_recent_products' })
export class SearchRecentProduct {
  @Prop({ index: true })
  userId?: string;

  @Prop({ index: true })
  sessionId?: string;

  @Prop({ required: true, index: true })
  productId!: string;

  @Prop({ required: true, default: () => new Date(), index: true })
  viewedAt!: Date;
}

export const SearchRecentProductSchema =
  SchemaFactory.createForClass(SearchRecentProduct);

SearchRecentProductSchema.index({ userId: 1, viewedAt: -1 });
SearchRecentProductSchema.index({ sessionId: 1, viewedAt: -1 });
SearchRecentProductSchema.index(
  { userId: 1, productId: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: 'string' } } },
);
SearchRecentProductSchema.index(
  { sessionId: 1, productId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sessionId: { $type: 'string' },
      userId: { $exists: false },
    },
  },
);
