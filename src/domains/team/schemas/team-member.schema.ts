import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { MemberRole } from '@shared/lib';

@Schema({ timestamps: true })
export class TeamMemberSchema {
  @Prop({ required: true, trim: true, maxlength: 100 })
  name: string;

  @Prop({ required: true, trim: true, lowercase: true })
  email: string;

  @Prop({ enum: MemberRole, default: MemberRole.MEMBER })
  role: MemberRole;
}

export const TeamMemberSchemaFactory = SchemaFactory.createForClass(TeamMemberSchema);
