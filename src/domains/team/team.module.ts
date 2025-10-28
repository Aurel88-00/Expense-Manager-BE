import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TeamController } from './controllers/team.controller';
import { TeamService } from './services/team.service';
import { Team, TeamSchema } from './schemas/team.schema';
import { Expense, ExpenseSchema } from '../expense/schemas/expense.schema';
import { EmailService } from '@shared/services/email.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Team.name, schema: TeamSchema },
      { name: Expense.name, schema: ExpenseSchema },
    ]),
  ],
  controllers: [TeamController],
  providers: [TeamService, EmailService],
  exports: [TeamService],
})
export class TeamModule {}
