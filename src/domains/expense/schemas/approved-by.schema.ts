import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema({ timestamps: true })
export class ApprovedBySchema {
  @Prop({ trim: true, maxlength: 100 })
  name: string;

  @Prop({ trim: true, lowercase: true })
  email: string;

  @Prop()
  approvedAt: Date;
}

export const ApprovedBySchemaFactory = SchemaFactory.createForClass(ApprovedBySchema);
