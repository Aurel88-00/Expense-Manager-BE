import { IsString, IsNumber, IsEnum, IsDateString, IsEmail, IsOptional, IsBoolean, IsMongoId, Min, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';
import { ExpenseCategory, ExpenseStatus } from '@shared/lib';

export class SubmitterDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;
}

export class ApprovedByDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsEmail()
  email: string;

  @IsDateString()
  approvedAt: string;
}

export class CreateExpenseDto {
  @IsMongoId()
  team: string;

  @IsString()
  @MaxLength(500)
  description: string;

  @IsNumber()
  @Min(0)
  amount: number;

  @IsEnum(ExpenseCategory)
  category: ExpenseCategory;

  @IsDateString()
  date: string;
  
  @IsOptional()
  @IsEnum(ExpenseStatus)
  status?: ExpenseStatus;

  @Type(() => SubmitterDto)
  @IsOptional()
  submittedBy?: SubmitterDto;
}

export class UpdateExpenseDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  amount?: number;

  @IsOptional()
  @IsEnum(ExpenseCategory)
  category?: ExpenseCategory;

  @IsOptional()
  @IsDateString()
  date?: string;

  @IsOptional()
  @IsEnum(ExpenseStatus)
  status?: ExpenseStatus;

  @IsOptional()
  @Type(() => ApprovedByDto)
  approvedBy?: ApprovedByDto;
}

export class BulkActionDto {
  @IsString({ each: true })
  expenseIds: string[];

  @IsEnum(['approve', 'reject'])
  action: 'approve' | 'reject';

  @Type(() => SubmitterDto)
  approvedBy: SubmitterDto;
}

export class ExpenseResponseDto {
  _id: string;
  team: string | any;
  description: string;
  amount: number;
  category: ExpenseCategory;
  aiSuggestedCategory?: ExpenseCategory;
  status: ExpenseStatus;
  submittedBy: SubmitterDto;
  approvedBy?: ApprovedByDto;
  date: string;
  isDuplicate?: boolean;
  duplicateReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

export class BudgetStatusDto {
  teamId: string;
  teamName: string;
  budget: number;
  currentSpending: number;
  remainingBudget: number;
  utilizationPercentage: number;
  isOverBudget: boolean;
  isNearBudget: boolean;
  alertStatus: {
    eightyPercentSent: boolean;
    hundredPercentSent: boolean;
  };
}

export class SpendingInsightsDto {
  summary: string;
  topCategory: string;
  trends: string;
  recommendations: string[];
  budgetHealth: string;
  totalSpent: number;
  budgetUtilization: number;
  categoryBreakdown: Record<string, number>;
}

export class BudgetForecastDto {
  willExceedBudget: boolean;
  confidence: number;
  predictedOverspend: number;
  monthsToExceed: number;
  recommendations: string[];
  averageMonthlySpending: number;
  currentUtilization: number;
}
