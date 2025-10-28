import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Team, TeamSchema, TeamDocument } from '../schemas/team.schema';
import { Expense, ExpenseSchema, ExpenseDocument } from '../../expense/schemas/expense.schema';
import { CreateTeamDto, UpdateTeamDto } from '../dto/team.dto';
import { EmailService } from '../../../shared/services/email.service';

@Injectable()
export class TeamService {
  private readonly logger = new Logger(TeamService.name);

  constructor(
    @InjectModel(Team.name) private teamModel: Model<TeamDocument>,
    @InjectModel(Expense.name) private expenseModel: Model<ExpenseDocument>,
    private emailService: EmailService,
  ) {}

  async create(createTeamDto: CreateTeamDto): Promise<Team> {
    const existingTeam = await this.teamModel.findOne({ name: createTeamDto.name });
    if (existingTeam) {
      throw new BadRequestException('Team name already exists');
    }

    const team = new this.teamModel(createTeamDto);
    return team.save();
  }

  async findAll(): Promise<Team[]> {
    const teams = await this.teamModel.find().sort({ createdAt: -1 }).exec();
    
    this.logger.log(`Found ${teams.length} teams`);
    
    for (const team of teams) {
      await this.checkAndSendBudgetAlerts(team);
    }
    
    this.logger.log(`Returning teams:`, (teams as any[]).map(t => ({ name: t.name, currentSpending: t.currentSpending, budget: t.budget })));
    
    return teams;
  }

  private async checkAndSendBudgetAlerts(team: any): Promise<void> {
    const utilization = (team.currentSpending / team.budget) * 100;
    
    // Check if 100% alert should be sent
    if (utilization >= 100 && !team.budgetAlerts.hundredPercentSent) {
      this.logger.log(`Sending 100% budget alert for ${team.name} (${utilization.toFixed(1)}%)`);
      try {
        await this.emailService.sendBudgetAlert(team, 'hundred_percent');
        team.budgetAlerts.hundredPercentSent = true;
        await team.save();
        this.logger.log(`100% budget alert sent successfully for ${team.name}`);
      } catch (error) {
        this.logger.error(`Failed to send 100% alert for ${team.name}:`, error);
      }
    }
    
    // Check if 80% alert should be sent
    if (utilization >= 80 && !team.budgetAlerts.eightyPercentSent && utilization < 100) {
      this.logger.log(`Sending 80% budget alert for ${team.name} (${utilization.toFixed(1)}%)`);
      try {
        await this.emailService.sendBudgetAlert(team, 'eighty_percent');
        team.budgetAlerts.eightyPercentSent = true;
        await team.save();
        this.logger.log(`80% budget alert sent successfully for ${team.name}`);
      } catch (error) {
        this.logger.error(`Failed to send 80% alert for ${team.name}:`, error);
      }
    }
  }

  private async calculateCurrentSpending(teamId: string): Promise<number> {
    this.logger.log(` Calculating for team ID: ${teamId} (type: ${typeof teamId})`);
    
    const teamObjectId = Types.ObjectId.isValid(teamId) ? new Types.ObjectId(teamId) : null;
    
    const orConditions: any[] = [];
    if (teamObjectId) {
      orConditions.push({ team: teamObjectId });
    }
    orConditions.push({ $expr: { $eq: [ { $toString: '$team' }, teamId ] } });
    
    const approvedExpenses = await this.expenseModel.find({ 
      status: 'approved',
      $or: orConditions
    }).exec();
    
    this.logger.log(`Found ${approvedExpenses.length} approved expenses for team ${teamId}`);
    
    if (approvedExpenses.length > 0) {
      approvedExpenses.forEach(expense => {
        this.logger.log(`Expense: ${expense._id}, amount: ${expense.amount}, team: ${expense.team}, status: ${expense.status}`);
      });
    }
    
    let total = 0;
    for (const expense of approvedExpenses) {
      total += expense.amount;
    }
    
    this.logger.log(`Total calculated: ${total}`);
    return total;
  }

  async findOne(id: string): Promise<Team> {
    const team = await this.teamModel.findById(id).exec();
    if (!team) {
      throw new NotFoundException('Team not found');
    }
    
    const currentSpending = await this.calculateCurrentSpending(id);
    team.currentSpending = currentSpending;
    await team.save();
    
    return team;
  }

  async update(id: string, updateTeamDto: UpdateTeamDto): Promise<Team> {
    const team = await this.teamModel.findById(id).exec();
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    if (updateTeamDto.name && updateTeamDto.name !== team.name) {
      const existingTeam = await this.teamModel.findOne({ 
        name: updateTeamDto.name, 
        _id: { $ne: id } 
      });
      if (existingTeam) {
        throw new BadRequestException('Team name already exists');
      }
    }

    Object.assign(team, updateTeamDto);
    return team.save();
  }

  async remove(id: string): Promise<void> {
    const team = await this.teamModel.findById(id).exec();
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const expenseCount = await this.expenseModel.countDocuments({ team: id });
    if (expenseCount > 0) {
      throw new BadRequestException(`Cannot delete team with ${expenseCount} associated expenses`);
    }

    await this.teamModel.findByIdAndDelete(id).exec();
  }

  async getBudgetStatus(id: string): Promise<any> {
    const team = await this.teamModel.findById(id).exec();
    if (!team) {
      throw new NotFoundException('Team not found');
    }

    const currentSpending = await this.calculateCurrentSpending(id);
    
    team.currentSpending = currentSpending;
    await team.save();

    const budgetStatus = {
      teamId: team._id,
      teamName: team.name,
      budget: team.budget,
      currentSpending,
      remainingBudget: team.budget - currentSpending,
      utilizationPercentage: (currentSpending / team.budget) * 100,
      isOverBudget: currentSpending > team.budget,
      isNearBudget: (currentSpending / team.budget) >= 0.8,
      alertStatus: {
        eightyPercentSent: team.budgetAlerts.eightyPercentSent,
        hundredPercentSent: team.budgetAlerts.hundredPercentSent
      }
    };

    const utilization = budgetStatus.utilizationPercentage;
    
    if (utilization >= 100 && !team.budgetAlerts.hundredPercentSent) {
      await this.emailService.sendBudgetAlert(team, 'hundred_percent');
      team.budgetAlerts.hundredPercentSent = true;
      await team.save();
    } else if (utilization >= 80 && !team.budgetAlerts.eightyPercentSent) {
      await this.emailService.sendBudgetAlert(team, 'eighty_percent');
      team.budgetAlerts.eightyPercentSent = true;
      await team.save();
    }

    return budgetStatus;
  }

  async getExpenses(id: string, query: any): Promise<{ expenses: Expense[]; pagination: any }> {
    const { status, category, startDate, endDate, limit = 50, page = 1 } = query;
    
    const filter: any = { team: id };
    
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (startDate || endDate) {
      filter.date = {};
      if (startDate) filter.date.$gte = new Date(startDate);
      if (endDate) filter.date.$lte = new Date(endDate);
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const expenses = await this.expenseModel.find(filter)
      .sort({ date: -1 })
      .limit(parseInt(limit))
      .skip(skip)
      .populate('team', 'name')
      .exec();

    const total = await this.expenseModel.countDocuments(filter);
    
    const parsedPage = parseInt(page);
    const parsedLimit = parseInt(limit);
    
    return {
      expenses,
      pagination: {
        total,
        page: parsedPage,
        limit: parsedLimit,
        pages: Math.ceil(total / parsedLimit)
      }
    };
  }
}
