import { ExpenseCategory } from "@shared/lib";
import { ExpenseDocument } from "../schemas/expense.schema";

export type CreateExpenseResponse = {
    expense: ExpenseDocument;
    aiSuggestion?: { 
      category: ExpenseCategory | undefined; 
      [key: string]: any;
    } | null;
    duplicateWarning?: {
      isDuplicate: boolean ;
      confidence: number | undefined;
      reason: string | undefined;
      [key: string]: any;
    } | null;
  }