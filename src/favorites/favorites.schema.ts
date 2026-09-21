import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type FavoritesDocument = HydratedDocument<Favorites>;

@Schema({ timestamps: true, collection: 'favorites' })
export class Favorites {
  @Prop()
  userId?: string;

  @Prop()
  sessionId?: string;

  @Prop({ type: [String], default: [] })
  productIds!: string[];
}

export const FavoritesSchema = SchemaFactory.createForClass(Favorites);

FavoritesSchema.index(
  { userId: 1 },
  { unique: true, partialFilterExpression: { userId: { $type: 'string' } } },
);
FavoritesSchema.index(
  { sessionId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      sessionId: { $type: 'string' },
      userId: { $exists: false },
    },
  },
);
