import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ExpenseController } from './controllers/expense.controller';
import { ExpenseService } from './services/expense.service';
import { Expense, ExpenseSchema } from './schemas/expense.schema';
import { Team, TeamSchema } from '../team/schemas/team.schema';
import { EmailService } from '@shared/services/email.service';
import { AiService } from '@shared/services/ai.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Expense.name, schema: ExpenseSchema },
      { name: Team.name, schema: TeamSchema },
    ]),
  ],
  controllers: [ExpenseController],
  providers: [ExpenseService, EmailService, AiService],
  exports: [ExpenseService],
})
export class ExpenseModule {}
