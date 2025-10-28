import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';
import { ExpenseCategory, ExpenseStatus, Submitter, ApprovedBy, Receipt } from '@shared/lib';
import { SubmitterSchema } from './submitter.schema';
import { ApprovedBySchema } from './approved-by.schema';

export type ExpenseDocument = Expense & Document;

@Schema({ timestamps: true })
export class Expense {
  @Prop({ type: Types.ObjectId, ref: 'Team', required: true })
  team: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 500 })
  description: string;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ enum: ExpenseCategory, required: true })
  category: ExpenseCategory;

  @Prop({ enum: ExpenseCategory })
  aiSuggestedCategory: ExpenseCategory;

  @Prop({ enum: ExpenseStatus, default: ExpenseStatus.PENDING })
  status: ExpenseStatus;

  @Prop({ type: SubmitterSchema, required: true })
  submittedBy: SubmitterSchema;

  @Prop({ type: ApprovedBySchema })
  approvedBy: ApprovedBySchema;

  @Prop({
    type: {
      filename: String,
      originalName: String,
      mimetype: String,
      size: Number,
    },
  })
  receipt: {
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
  };

  @Prop({ required: true })
  date: Date;

  @Prop({ default: false })
  isDuplicate: boolean;

  @Prop()
  duplicateReason: string;
}

export const ExpenseSchema = SchemaFactory.createForClass(Expense);

// Indexes
ExpenseSchema.index({ team: 1, date: -1 });
ExpenseSchema.index({ status: 1 });
ExpenseSchema.index({ category: 1 });
