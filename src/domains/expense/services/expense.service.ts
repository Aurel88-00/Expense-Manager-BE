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

    // Verify team exists
    const team = await this.teamModel.findById(teamId);
    if (!team) {
      throw new BadRequestException('Team not found');
    }

    // Get AI category suggestion
    const aiSuggestion = await this.aiService.suggestExpenseCategory(
      createExpenseDto.description,
      createExpenseDto.amount,
    );
    let aiSuggestedCategory: any = null;
    if (aiSuggestion.success) {
      aiSuggestedCategory = aiSuggestion.category;
    }

    // Check for potential duplicates
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

    const expense = new this.expenseModel({
      ...createExpenseDto,
      team: teamId,
      date: new Date(createExpenseDto.date),
      aiSuggestedCategory,
      isDuplicate: duplicateCheck.success ? duplicateCheck.isDuplicate : false,
      duplicateReason: duplicateCheck.success ? duplicateCheck.reason : null,
    });

    const savedExpense = await expense.save();

    const result = {
      expense: savedExpense,
      aiSuggestion: null,
      duplicateWarning: null,
    } as CreateExpenseResponse;

    if (aiSuggestion.success) {
      result.aiSuggestion = { category: aiSuggestion.category } as any;
    }
    if (duplicateCheck.success && duplicateCheck.isDuplicate) {
      result.duplicateWarning = {
        isDuplicate: true,
        confidence: duplicateCheck.confidence,
        reason: duplicateCheck.reason,
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
      .limit(parseInt(limit))
      .skip(skip)
      .populate('team', 'name budget currentSpending')
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
    return expense;
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

    // Update fields
    if (updateExpenseDto.description)
      expense.description = updateExpenseDto.description;
    if (updateExpenseDto.amount !== undefined)
      expense.amount = updateExpenseDto.amount;
    if (updateExpenseDto.category) expense.category = updateExpenseDto.category;
    if (updateExpenseDto.date) expense.date = new Date(updateExpenseDto.date);
    if (updateExpenseDto.status) expense.status = updateExpenseDto.status;

    // If status changed to approved/rejected, update approval info
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

    // If status changed, send email notification
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

    // If expense was approved, update team's current spending
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

    // If expense was unapproved (from approved to pending/rejected), subtract from team spending
    if (oldStatus === 'approved' && updateExpenseDto.status !== 'approved') {
      // Get team ID - handle both ObjectId and populated object
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

    // Populate team field and return
    await savedExpense.populate('team', 'name budget');
    return savedExpense;
  }

  async remove(id: string): Promise<void> {
    const expense = await this.expenseModel.findById(id).exec();
    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    // If expense was approved, subtract from team's current spending
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
    // Verify team exists
    const team = await this.teamModel.findById(teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Convert string to ObjectId for proper MongoDB query
    const teamObjectId = new Types.ObjectId(teamId);

    // Get all approved expenses for the team
    const expenses = await this.expenseModel
      .find({
        team: teamObjectId,
        status: 'approved',
      })
      .sort({ date: -1 });

    // Generate AI insights
    const insights = await this.aiService.generateSpendingInsights(
      teamId,
      expenses,
      team.budget,
    );

    if (!insights.success) {
      throw new BadRequestException(insights.error);
    }

    return insights.insights;
  }

  async getForecast(teamId: string): Promise<any> {
    // Verify team exists
    const team = await this.teamModel.findById(teamId);
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    // Convert string to ObjectId for proper MongoDB query
    const teamObjectId = new Types.ObjectId(teamId);

    // Get all approved expenses for the team
    const expenses = await this.expenseModel
      .find({
        team: teamObjectId,
        status: 'approved',
      })
      .sort({ date: -1 });

    // Generate budget forecast
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

    // Update all expenses
    const updatePromises = expenses.map(async (expense) => {
      const oldStatus = expense.status;
      expense.status = newStatus as any;
      expense.approvedBy = {
        name: approvedBy.name,
        email: approvedBy.email,
        approvedAt: new Date(),
      };

      const savedExpense = await expense.save();

      // Send email notification
      await this.emailService.sendExpenseApprovalNotification(
        savedExpense,
        newStatus === 'approved',
      );

      // Update team spending if approved
      if (newStatus === 'approved' && oldStatus !== 'approved') {
        const team = await this.teamModel.findById(expense.team);
        if (team) {
          team.currentSpending += expense.amount;
          await team.save();
        }
      }

      return savedExpense;
    });

    await Promise.all(updatePromises);

    return {
      message: `${expenses.length} expenses ${action}d successfully`,
      updatedCount: expenses.length,
    };
  }

  async exportPdf(filter: any): Promise<Buffer> {
    const { expenses } = await this.findAll({
      ...filter,
      limit: 1000,
      page: 1,
      sortBy: 'date',
      sortOrder: 'desc',
    });

    const PDFDocument = (await import('pdfkit')).default;
    const doc = new PDFDocument({ size: 'A4', margin: 40 });
    const chunks: Buffer[] = [];
    const { format } = await import('date-fns');

    const money = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    });

    const marginLeft = 40;
    const marginRight = 555; 
    const tableTopStart = 170; 

    const colX = {
      description: marginLeft,
      amount: 250, 
      category: 320, 
      date: 420, 
      team: 500, 
    } as const;
    const colWidth = {
      description: 140, 
      amount: 60,
      category: 80,
      date: 70,
      team: 60,
    } as const;
    const rowHeight = 50;

    const drawHeader = () => {
      doc.fontSize(11).fillColor('#111111').font('Helvetica-Bold');
      const headerY = doc.y;
      doc
        .rect(marginLeft - 2, headerY - 4, marginRight - marginLeft + 4, rowHeight)
        .fill('#F3F4F6');
      doc.fillColor('#111111');
      doc.text('Description', colX.description, headerY, { width: colWidth.description });
      doc.text('Amount', colX.amount, headerY, { width: colWidth.amount, align: 'right' });
      doc.text('Category', colX.category, headerY, { width: colWidth.category });
      doc.text('Date', colX.date, headerY, { width: colWidth.date });
      doc.text('Team', colX.team, headerY, { width: colWidth.team, align: 'left' }); 
    //   doc.moveDown(1);
    //  doc.moveTo(marginLeft, doc.y).lineTo(marginRight, doc.y).strokeColor('#E5E7EB').stroke();
      doc.strokeColor('#000000');
    };

    const ensureSpaceForRow = () => {
      if (doc.y + rowHeight * 1.5 > doc.page.height - doc.page.margins.bottom) { 
        doc.addPage();
        doc.font('Helvetica-Bold').fontSize(12).text('Expense Report (cont.)', { align: 'left' });
        doc.moveDown(0.5);
        drawHeader();
      }
    };

    const truncate = (text: unknown, max = 60) => {
      const s = String(text ?? '');
      return s.length > max ? `${s.slice(0, max - 1)}…` : s;
    };

    return await new Promise<Buffer>((resolve, reject) => {
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('error', (err: Error) => reject(err));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      // Title
      doc.fontSize(18).font('Helvetica-Bold').text('Expense Report', { align: 'center' });
      doc.moveDown(0.25);
      doc.fontSize(10).font('Helvetica').text(`Generated: ${format(new Date(), 'PPpp')}`, { align: 'center' });
      doc.moveDown(0.75);

      // Filters summary
      const usedFilters: string[] = [];
      try {
        const entries = Object.entries(filter ?? {}) as Array<[string, unknown]>;
        for (const [k, v] of entries) {
          if (v !== undefined && v !== null && String(v).length > 0) {
            usedFilters.push(`${k}: ${String(v)}`);
          }
        }
      } catch {}
      if (usedFilters.length > 0) {
        doc.fontSize(10).fillColor('#374151').text(`Filters: ${usedFilters.join('  |  ')}`);
        doc.fillColor('#000000');
      }
      doc.moveDown(0.75);

      // Position at table start
      doc.y = tableTopStart;
      drawHeader();

      let totalAmount = 0;
      expenses.forEach((e, idx) => {
        ensureSpaceForRow();
        const y = doc.y + 8;
        const isStripe = idx % 2 === 0;
        if (isStripe) {
          doc
            .rect(marginLeft - 2, doc.y - 2, marginRight - marginLeft + 4, rowHeight)
            .fill('#FAFAFA');
          doc.fillColor('#000000');
        }

        const teamName = typeof (e as any).team === 'object' && (e as any).team?.name
          ? (e as any).team.name
          : String((e as any).team ?? 'N/A');

        const desc = truncate((e as any).description, 50);
        const amount = money.format(Number((e as any).amount ?? 0));
        const category = String((e as any).category ?? '');
        const dateStr = format(new Date((e as any).date), 'yyyy-MM-dd');
        const teamNameTruncated = truncate(teamName, 18);

        totalAmount += Number((e as any).amount ?? 0);

        doc.fontSize(10).text(desc, colX.description, y, { width: colWidth.description });
        doc.text(amount, colX.amount, y, { width: colWidth.amount, align: 'right' });
        doc.text(category, colX.category, y, { width: colWidth.category });
        doc.text(dateStr, colX.date, y, { width: colWidth.date });
        // Ensure Team text is left-aligned, matching the header
        doc.text(teamNameTruncated, colX.team, y, { width: colWidth.team, align: 'left' }); 

        // move to next row
        // Adjusted the move to next row to match the smaller rowHeight
        doc.y = y + rowHeight - 8;
      });

      // Totals
      ensureSpaceForRow();
      doc.moveDown(0.25);
      doc.moveTo(marginLeft, doc.y).lineTo(marginRight, doc.y).strokeColor('#E5E7EB').stroke();
      doc.strokeColor('#000000');
      doc.moveDown(0.25);
      doc.font('Helvetica-Bold');
      doc.text('Total', colX.description, doc.y, { width: colWidth.description });
      doc.text(money.format(totalAmount), colX.amount, doc.y, { width: colWidth.amount, align: 'right' });
      doc.font('Helvetica');

      doc.end();
    });
  }
}
