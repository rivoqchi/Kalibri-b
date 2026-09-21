import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type SearchHistoryDocument = HydratedDocument<SearchHistory>;

@Schema({ timestamps: true, collection: 'search_histories' })
export class SearchHistory {
  @Prop({ index: true })
  userId?: string;

  @Prop({ index: true })
  sessionId?: string;

  @Prop({ required: true, trim: true })
  query!: string;

  @Prop({ required: true, trim: true, lowercase: true, index: true })
  queryKey!: string;

  @Prop({ trim: true })
  correctedQuery?: string;

  @Prop({ required: true, default: () => new Date(), index: true })
  searchedAt!: Date;
}

export const SearchHistorySchema = SchemaFactory.createForClass(SearchHistory);

SearchHistorySchema.index({ userId: 1, searchedAt: -1 });
SearchHistorySchema.index({ sessionId: 1, searchedAt: -1 });
SearchHistorySchema.index(
  { userId: 1, queryKey: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: 'string' } } },
);
SearchHistorySchema.index(
  { sessionId: 1, queryKey: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sessionId: { $type: 'string' },
      userId: { $exists: false },
    },
  },
);
