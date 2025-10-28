import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Expense,
  ExpenseSchema,
  ExpenseDocument,
} from '../schemas/expense.schema';
import { Team, TeamSchema, TeamDocument } from '../../team/schemas/team.schema';
import {
  CreateExpenseDto,
  UpdateExpenseDto,
  BulkActionDto,
} from '../dto/expense.dto';
import { EmailService } from '../../../shared/services/email.service';
import { AiService } from '../../../shared/services/ai.service';
import { CreateExpenseResponse } from '../types/types';
import { ExpenseStatus } from '@shared/lib';

@Injectable()
export class ExpenseService {
  private readonly logger = new Logger(ExpenseService.name);

  constructor(
    @InjectModel(Expense.name) private expenseModel: Model<ExpenseDocument>,
    @InjectModel(Team.name) private teamModel: Model<TeamDocument>,
    private emailService: EmailService,
    private aiService: AiService,
  ) {}

  async create(
    createExpenseDto: CreateExpenseDto,
  ): Promise<CreateExpenseResponse> {
    const teamId = Types.ObjectId.isValid(String(createExpenseDto.team))
      ? new Types.ObjectId(String(createExpenseDto.team))
      : createExpenseDto.team;

    const team = await this.teamModel.findById(teamId);
    if (!team) {
      throw new BadRequestException('Team not found');
    }

    // Disable AI services in production to save memory
    let aiSuggestedCategory: any = null;
    let isDuplicate = false;
    let duplicateReason: string | null = null;

    if (process.env.NODE_ENV !== 'production') {
      try {
        const aiSuggestion = await this.aiService.suggestExpenseCategory(
          createExpenseDto.description,
          createExpenseDto.amount,
        );
        if (aiSuggestion.success) {
          aiSuggestedCategory = aiSuggestion.category;
        }

        const recentExpenses = await this.expenseModel
          .find({
            $or: [
              { team: teamId },
              { $expr: { $eq: [{ $toString: '$team' }, String(teamId)] } },
            ],
            date: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
          })
          .limit(10);

        const duplicateCheck = await this.aiService.detectDuplicateExpense(
          createExpenseDto.description,
          createExpenseDto.amount,
          createExpenseDto.team,
          recentExpenses,
        );

        if (duplicateCheck.success) {
          isDuplicate = duplicateCheck.isDuplicate || false;
          duplicateReason = duplicateCheck.reason || null;
        }
      } catch (error) {
        this.logger.warn('AI services unavailable, proceeding without AI features');
      }
    }

    const expense = new this.expenseModel({
      ...createExpenseDto,
      team: teamId,
      date: new Date(createExpenseDto.date),
      aiSuggestedCategory,
      isDuplicate,
      duplicateReason,
    });

    const savedExpense = await expense.save();

    const result = {
      expense: savedExpense,
      aiSuggestion: null,
      duplicateWarning: null,
    } as unknown as CreateExpenseResponse;

    if (aiSuggestedCategory) {
      result.aiSuggestion = { category: aiSuggestedCategory } as any;
    }
    if (isDuplicate) {
      result.duplicateWarning = {
        isDuplicate: true,
        confidence: 0.8, 
        reason: duplicateReason || 'Potential duplicate detected',
      } as any;
    }

    return result;
  }

  async findAll(
    query: any,
  ): Promise<{ expenses: ExpenseDocument[]; pagination: any }> {
    const {
      team,
      status,
      category,
      startDate,
      endDate,
      search,
      limit = 50,
      page = 1,
      sortBy = 'date',
      sortOrder = 'desc',
    } = query;

    const filter: any = {};

    if (team) {
      filter.team = Types.ObjectId.isValid(String(team))
        ? new Types.ObjectId(String(team))
        : team;
    }
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }
    if (search) {
      filter.$or = [
        { description: { $regex: search, $options: 'i' } },
        { category: { $regex: search, $options: 'i' } },
      ];
    }

    const pageNum: number = typeof page === 'number' ? page : parseInt(page);
    const limitNum: number = typeof limit === 'number' ? limit : parseInt(limit);
    const skip = (pageNum - 1) * limitNum;
    const sort: Record<string, 1 | -1> = { [sortBy]: sortOrder === 'desc' ? -1 : 1 } as any;

    const expenses = await this.expenseModel
      .find(filter)
      .sort(sort)
      .limit(Math.min(parseInt(limit), 50)) 
      .skip(skip)
      .populate('team', 'name budget currentSpending')
      .lean() 
      .exec();

    const total = await this.expenseModel.countDocuments(filter);

    const pagination: any = {
      total: Number(total),
      page: Number(pageNum),
      limit: Number(limitNum),
      pages: Math.ceil(Number(total) / Number(limitNum)),
    };

    const typedExpenses = expenses as unknown as ExpenseDocument[];
    return { expenses: typedExpenses, pagination };
  }

  async findOne(id: string): Promise<ExpenseDocument> {
    const expense = await this.expenseModel
      .findById(id)
      .populate('team', 'name budget')
      .exec();
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }
    return expense as unknown as ExpenseDocument;
  }

  async update(
    id: string,
    updateExpenseDto: UpdateExpenseDto,
  ): Promise<Expense> {
    const expense = await this.expenseModel.findById(id).exec();
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    this.logger.log(
      `[update] Updating expense ${id}, current status: ${expense.status}, new status: ${updateExpenseDto.status}`,
    );
    this.logger.log(
      `[update] Expense team field type: ${typeof expense.team}, value: ${expense.team}`,
    );

    const oldStatus = expense.status;

    if (updateExpenseDto.description)
      expense.description = updateExpenseDto.description;
    if (updateExpenseDto.amount !== undefined)
      expense.amount = updateExpenseDto.amount;
    if (updateExpenseDto.category) expense.category = updateExpenseDto.category;
    if (updateExpenseDto.date) expense.date = new Date(updateExpenseDto.date);
    if (updateExpenseDto.status) expense.status = updateExpenseDto.status;

    if (
      updateExpenseDto.status &&
      updateExpenseDto.status !== oldStatus &&
      (updateExpenseDto.status === 'approved' ||
        updateExpenseDto.status === 'rejected')
    ) {
      expense.approvedBy = {
        name: updateExpenseDto.approvedBy?.name || 'System',
        email:
          updateExpenseDto.approvedBy?.email || 'system@expensemanagement.com',
        approvedAt: new Date(),
      };
    }

    const savedExpense = await expense.save();

    if (
      updateExpenseDto.status &&
      updateExpenseDto.status !== oldStatus &&
      (updateExpenseDto.status === 'approved' ||
        updateExpenseDto.status === 'rejected')
    ) {
      await this.emailService.sendExpenseApprovalNotification(
        savedExpense,
        updateExpenseDto.status === 'approved',
      );
    }

    if (updateExpenseDto.status === 'approved' && oldStatus !== 'approved') {
      const teamId =
        typeof expense.team === 'object' && expense.team !== null
          ? (expense.team as any)._id
          : expense.team;

      this.logger.log(
        `Expense approved: ${expense._id}, amount: ${expense.amount}, team: ${teamId}`,
      );
      const team = await this.teamModel.findById(teamId);
      if (team) {
        const oldSpending = team.currentSpending;
        team.currentSpending += expense.amount;
        await team.save();
        this.logger.log(
          `Team ${team.name} spending updated: ${oldSpending} -> ${team.currentSpending}`,
        );

        // Check if budget alerts need to be sent
        const utilization = (team.currentSpending / team.budget) * 100;
        this.logger.log(`Budget utilization: ${utilization.toFixed(1)}%`);

        if (utilization >= 100 && !team.budgetAlerts.hundredPercentSent) {
          this.logger.log(`Sending 100% budget alert for ${team.name}`);
          await this.emailService.sendBudgetAlert(team, 'hundred_percent');
          team.budgetAlerts.hundredPercentSent = true;
          await team.save();
        } else if (utilization >= 80 && !team.budgetAlerts.eightyPercentSent) {
          this.logger.log(`Sending 80% budget alert for ${team.name}`);
          await this.emailService.sendBudgetAlert(team, 'eighty_percent');
          team.budgetAlerts.eightyPercentSent = true;
          await team.save();
        }
      } else {
        this.logger.error(
          ` Team not found for expense ${expense._id}, team ID: ${teamId}`,
        );
      }
    }

    if (oldStatus === 'approved' && updateExpenseDto.status !== 'approved') {
      const teamId =
        typeof expense.team === 'object' && expense.team !== null
          ? (expense.team as any)._id
          : expense.team;

      this.logger.log(
        `Expense unapproved: ${expense._id}, amount: ${expense.amount}, team: ${teamId}`,
      );
      const team = await this.teamModel.findById(teamId);
      if (team) {
        const oldSpending = team.currentSpending;
        team.currentSpending = Math.max(
          0,
          team.currentSpending - expense.amount,
        );
        await team.save();
        this.logger.log(
          `Team ${team.name} spending updated: ${oldSpending} -> ${team.currentSpending}`,
        );
      }
    }

    await savedExpense.populate('team', 'name budget');
    return savedExpense;
  }

  async remove(id: string): Promise<void> {
    const expense = await this.expenseModel.findById(id).exec();
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    if (expense.status === 'approved') {
      const team = await this.teamModel.findById(expense.team);
      if (team) {
        team.currentSpending = Math.max(
          0,
          team.currentSpending - expense.amount,
        );
        await team.save();
      }
    }

    await this.expenseModel.findByIdAndDelete(id).exec();
  }

  async getInsights(teamId: string): Promise<any> {
    // Disable AI services in production to save memory
    if (process.env.NODE_ENV === 'production') {
      return {
        summary: 'AI insights disabled in production to optimize memory usage',
        topCategory: 'N/A',
        trends: 'N/A',
        recommendations: ['Upgrade to paid tier for AI features'],
        budgetHealth: 'N/A',
        totalSpent: 0,
        budgetUtilization: 0,
        categoryBreakdown: {}
      };
    }

    const team = await this.teamModel.findById(teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const teamObjectId = new Types.ObjectId(teamId);

    const expenses = await this.expenseModel
      .find({
        team: teamObjectId,
        status: 'approved',
      })
      .sort({ date: -1 });

    try {
      const insights = await this.aiService.generateSpendingInsights(
        teamId,
        expenses,
        team.budget,
      );

      if (!insights.success) {
        throw new BadRequestException(insights.error);
      }

      return insights.insights;
    } catch (error) {
      this.logger.warn('AI insights service unavailable, returning basic data');
      return {
        summary: 'AI insights temporarily unavailable',
        topCategory: 'N/A',
        trends: 'N/A',
        recommendations: ['AI services are temporarily unavailable'],
        budgetHealth: 'N/A',
        totalSpent: 0,
        budgetUtilization: 0,
        categoryBreakdown: {}
      };
    }
  }

  async getForecast(teamId: string): Promise<any> {
    // Disable AI services in production to save memory
    if (process.env.NODE_ENV === 'production') {
      return {
        willExceedBudget: false,
        confidence: 0,
        predictedOverspend: 0,
        monthsToExceed: 0,
        recommendations: ['Upgrade to paid tier for AI features'],
        averageMonthlySpending: 0,
        currentUtilization: 0
      };
    }

    const team = await this.teamModel.findById(teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const teamObjectId = new Types.ObjectId(teamId);

    const expenses = await this.expenseModel
      .find({
        team: teamObjectId,
        status: 'approved',
      })
      .sort({ date: -1 });

    try {
      const forecast = await this.aiService.forecastBudgetExceedance(
        teamId,
        expenses,
        team.budget,
        team.currentSpending,
      );

      if (!forecast.success) {
        throw new BadRequestException(forecast.error);
      }

      return forecast.forecast;
    } catch (error) {
      this.logger.warn('AI forecast service unavailable, returning basic data');
      return {
        willExceedBudget: false,
        confidence: 0,
        predictedOverspend: 0,
        monthsToExceed: 0,
        recommendations: ['AI services are temporarily unavailable'],
        averageMonthlySpending: 0,
        currentUtilization: 0
      };
    }
  }

  async bulkAction(
    bulkActionDto: BulkActionDto,
  ): Promise<{ message: string; updatedCount: number }> {
    const { expenseIds, action, approvedBy } = bulkActionDto;
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const expenses = await this.expenseModel.find({ _id: { $in: expenseIds } });

    if (expenses.length !== expenseIds.length) {
      throw new BadRequestException('Some expenses not found');
    }

    const updatePromises = (expenses as unknown as ExpenseDocument[]).map(async (expense) => {
      const oldStatus = expense.status;
      expense.status = newStatus as ExpenseStatus;
      expense.approvedBy = {
        name: approvedBy.name,
        email: approvedBy.email,
        approvedAt: new Date(),
      };

      const savedExpense = await expense.save();

      await this.emailService.sendExpenseApprovalNotification(
        savedExpense,
        newStatus === 'approved',
      );

      if (newStatus === 'approved' && oldStatus !== 'approved') {
        const team = await this.teamModel.findById(expense.team);
        if (team) {
          team.currentSpending += expense.amount;
          await team.save();
        }
      }

      return savedExpense as unknown as ExpenseDocument;
    });

    await Promise.all(updatePromises);

    return {
      message: `${expenses.length} expenses ${action}d successfully`,
      updatedCount: expenses.length,
    };
  }

  // PDF export removed for memory optimization on Render free tier
}
