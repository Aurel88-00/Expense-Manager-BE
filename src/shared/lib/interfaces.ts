import { ExpenseCategory, ExpenseStatus, MemberRole } from './enums';

export interface Submitter {
  name: string;
  email: string;
}

export interface ApprovedBy {
  name: string;
  email: string;
  approvedAt: Date;
}

export interface Receipt {
  filename: string;
  originalName: string;
  mimetype: string;
  size: number;
}

export interface TeamMember {
  name: string;
  email: string;
  role: MemberRole;
}

export interface BudgetAlerts {
  eightyPercentSent: boolean;
  hundredPercentSent: boolean;
}

export interface ExpenseData {
  team: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  aiSuggestedCategory?: ExpenseCategory;
  status: ExpenseStatus;
  submittedBy: Submitter;
  approvedBy?: ApprovedBy;
  receipt?: Receipt;
  date: Date;
  isDuplicate: boolean;
  duplicateReason?: string;
}

export interface TeamData {
  name: string;
  budget: number;
  members: Array<TeamMember>;
  currentSpending: number;
  budgetAlerts: BudgetAlerts;
}

export interface BudgetStatus {
  teamId: string;
  teamName: string;
  budget: number;
  currentSpending: number;
  remainingBudget: number;
  utilizationPercentage: number;
  isOverBudget: boolean;
  isNearBudget: boolean;
  alertStatus: BudgetAlerts;
}

export interface SpendingInsights {
  summary: string;
  topCategory: string;
  trends: string;
  recommendations: Array<string>;
  budgetHealth: string;
  totalSpent: number;
  budgetUtilization: number;
  categoryBreakdown: Record<string, number>;
}

export interface BudgetForecast {
  willExceedBudget: boolean;
  confidence: number;
  predictedOverspend: number;
  monthsToExceed: number;
  recommendations: Array<string>;
  averageMonthlySpending: number;
  currentUtilization: number;
}
