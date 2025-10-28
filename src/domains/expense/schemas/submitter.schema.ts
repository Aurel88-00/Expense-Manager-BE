import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class SubmitterSchema {
  @Prop({ required: true, trim: true, maxlength: 100 })
  name: string;

  @Prop({ required: true, trim: true, lowercase: true })
  email: string;
}

export const SubmitterSchemaFactory = SchemaFactory.createForClass(SubmitterSchema);
