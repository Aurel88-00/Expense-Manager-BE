import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import { TeamMemberSchema } from './team-member.schema';

export type TeamDocument = Team & Document;

@Schema({ timestamps: true })
export class Team {
  @Prop({ required: true, trim: true, maxlength: 100 })
  name: string;

  @Prop({ required: true, min: 0 })
  budget: number;

  @Prop({ type: [TeamMemberSchema], required: true })
  members: TeamMemberSchema[];

  @Prop({ default: 0 })
  currentSpending: number;

  @Prop({
    type: {
      eightyPercentSent: { type: Boolean, default: false },
      hundredPercentSent: { type: Boolean, default: false },
    },
    default: () => ({
      eightyPercentSent: false,
      hundredPercentSent: false,
    }),
  })
  budgetAlerts: {
    eightyPercentSent: boolean;
    hundredPercentSent: boolean;
  };
}

export const TeamSchema = SchemaFactory.createForClass(Team);

// Virtual for budget utilization percentage
TeamSchema.virtual('budgetUtilization').get(function() {
  return this.budget > 0 ? (this.currentSpending / this.budget) * 100 : 0;
});

// Virtual for remaining budget
TeamSchema.virtual('remainingBudget').get(function() {
  return this.budget - this.currentSpending;
});

TeamSchema.set('toJSON', { virtuals: true });
