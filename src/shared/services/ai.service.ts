import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import { ExpenseCategory } from '../lib';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);
  private openai: OpenAI;
  private requestQueue: Promise<any> = Promise.resolve();
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 2000; // 2 seconds between requests (free tier)
  private isRateLimited = false;
  private rateLimitResetTime = 0;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('ai.openaiApiKey');
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  private async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 2, 
    baseDelay = 2000 
  ): Promise<T> {
    const now = Date.now();
    if (this.isRateLimited && now < this.rateLimitResetTime) {
      const waitTime = this.rateLimitResetTime - now;
      this.logger.warn(`Still rate limited, skipping request. Resets in ${Math.ceil(waitTime / 1000)}s`);
      throw new Error('AI service temporarily unavailable due to rate limits');
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        // Rate limiting
        const now = Date.now();
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.MIN_REQUEST_INTERVAL) {
          await new Promise(resolve => 
            setTimeout(resolve, this.MIN_REQUEST_INTERVAL - timeSinceLastRequest)
          );
        }
        this.lastRequestTime = Date.now();

        const result = await fn();
        
        this.isRateLimited = false;
        this.rateLimitResetTime = 0;
        
        return result;
      } catch (error: any) {
        const isRateLimitError =
          error?.status === 429 ||
          error?.code === 'rate_limit_exceeded' ||
          error?.message?.includes('rate limit');
        
        const isLastAttempt = attempt === maxRetries;

        if (isRateLimitError) {
          this.isRateLimited = true;
          this.rateLimitResetTime = Date.now() + 60000;
          
          this.logger.warn(
            `OpenAI Rate Limit Hit - Free tier quota exceeded. ` +
            `AI features disabled for 60 seconds. Consider upgrading to paid tier.`
          );
          
          if (!isLastAttempt) {
            const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
            this.logger.warn(`Retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`);
            await new Promise(resolve => setTimeout(resolve, delay));
            continue;
          }
        }

        if (isLastAttempt || !isRateLimitError) {
          throw error;
        }
      }
    }
    throw new Error('Max retries exceeded');
  }

  private async queueRequest<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve, reject) => {
      this.requestQueue = this.requestQueue
        .then(() => this.withRetry(fn))
        .then(resolve)
        .catch(reject);
    });
  }

  async suggestExpenseCategory(description: string, amount: number): Promise<{ success: boolean; category?: ExpenseCategory; error?: string }> {
    try {
      if (!this.openai) {
        this.logger.warn('OpenAI API key not configured, skipping AI suggestion');
        return { success: false, error: 'AI service not configured' };
      }

      const prompt = `
        Analyze the following expense description and suggest the most appropriate category.
        
        Expense Description: "${description}"
        Amount: $${amount}
        
        Categories available:
        - Travel (flights, hotels, transportation, business trips)
        - Meals (restaurants, food, dining, catering)
        - Office Supplies (stationery, equipment, supplies)
        - Software (subscriptions, licenses, digital tools)
        - Marketing (advertising, promotional materials, events)
        - Training (courses, conferences, educational materials)
        - Equipment (hardware, machinery, tools)
        - Utilities (electricity, internet, phone, office rent)
        - Other (anything that doesn't fit the above categories)
        
        Respond with ONLY the category name, nothing else.
      `;

      const response = await this.queueRequest(() =>
        this.openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are an expert at categorizing business expenses. Always respond with only the category name."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          max_tokens: 50,
          temperature: 0.1,
        })
      );

      const suggestedCategory = response.choices[0].message.content?.trim();
      
      const validCategories = Object.values(ExpenseCategory);
      
      if (suggestedCategory && validCategories.includes(suggestedCategory as ExpenseCategory)) {
        return { success: true, category: suggestedCategory as ExpenseCategory };
      } else {
        return { success: false, error: 'Invalid category suggested by AI' };
      }
    } catch (error) {
      this.logger.error('Error getting AI category suggestion:', error);
      return { success: false, error: error.message };
    }
  }

  async detectDuplicateExpense(description: string, amount: number, teamId: string, existingExpenses: any[]): Promise<{ success: boolean; isDuplicate?: boolean; confidence?: number; reason?: string; error?: string }> {
    try {
      if (!this.openai) {
        this.logger.warn('OpenAI API key not configured, skipping duplicate detection');
        return { success: false, error: 'AI service not configured' };
      }

      if (!existingExpenses || existingExpenses.length === 0) {
        return { success: true, isDuplicate: false };
      }

      const prompt = `
        Analyze if this new expense might be a duplicate of any existing expenses.
        
        New Expense:
        - Description: "${description}"
        - Amount: $${amount}
        
        Existing Expenses:
        ${existingExpenses.map(exp => 
          `- Description: "${exp.description}" | Amount: $${exp.amount} | Date: ${new Date(exp.date).toLocaleDateString()}`
        ).join('\n')}
        
        Consider:
        1. Similar descriptions (even with slight variations)
        2. Same or very similar amounts
        3. Recent dates (within 30 days)
        4. Same category patterns
        
        Respond with JSON format:
        {
          "isDuplicate": true/false,
          "confidence": 0.0-1.0,
          "reason": "explanation of why it might be duplicate or not"
        }
      `;

      const response = await this.queueRequest(() =>
        this.openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are an expert at detecting duplicate expenses. Always respond with valid JSON format."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          max_tokens: 200,
          temperature: 0.1,
        })
      );

      const content = response.choices[0].message.content;
      if (!content) {
        return { success: false, error: 'No response from AI' };
      }
      const result = JSON.parse(content);
      
      return {
        success: true,
        isDuplicate: result.isDuplicate,
        confidence: result.confidence,
        reason: result.reason
      };
    } catch (error) {
      this.logger.error('Error detecting duplicate expense:', error);
      return { success: false, error: error.message };
    }
  }

  async generateSpendingInsights(teamId: string, expenses: any[], budget: number): Promise<{ success: boolean; insights?: any; error?: string }> {
    try {
      if (!this.openai) {
        this.logger.warn('OpenAI API key not configured, skipping insights generation');
        return { success: false, error: 'AI service not configured' };
      }

      if (!expenses || expenses.length === 0) {
        return { success: false, error: 'No expenses to analyze' };
      }

      const totalSpent = expenses.reduce((sum, exp) => sum + exp.amount, 0);
      const categoryBreakdown = expenses.reduce((acc, exp) => {
        acc[exp.category] = (acc[exp.category] || 0) + exp.amount;
        return acc;
      }, {});

      const prompt = `
        Analyze the spending patterns for this team and provide insights.
        
        Team Budget: $${budget}
        Total Spent: $${totalSpent}
        Budget Utilization: ${((totalSpent / budget) * 100).toFixed(1)}%
        
        Category Breakdown:
        ${Object.entries(categoryBreakdown).map(([cat, amount]) => 
          `- ${cat}: $${amount} (${(((amount as number) / totalSpent) * 100).toFixed(1)}%)`
        ).join('\n')}
        
        Recent Expenses (last 10):
        ${expenses.slice(0, 10).map(exp => 
          `- $${exp.amount} - ${exp.description} (${exp.category}) - ${new Date(exp.date).toLocaleDateString()}`
        ).join('\n')}
        
        Provide insights in JSON format:
        {
          "summary": "Brief overview of spending patterns",
          "topCategory": "Category with highest spending",
          "trends": "Notable trends or patterns",
          "recommendations": ["recommendation1", "recommendation2"],
          "budgetHealth": "assessment of budget status"
        }
      `;

      const response = await this.queueRequest(() =>
        this.openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are a financial analyst expert at providing spending insights. Always respond with valid JSON format."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          max_tokens: 500,
          temperature: 0.3,
        })
      );

      const content = response.choices[0].message.content;
      if (!content) {
        return { success: false, error: 'No response from AI' };
      }
      const insights = JSON.parse(content);
      
      return {
        success: true,
        insights: {
          ...insights,
          totalSpent,
          budgetUtilization: (totalSpent / budget) * 100,
          categoryBreakdown
        }
      };
    } catch (error) {
      this.logger.error('Error generating spending insights:', error);
      return { success: false, error: error.message };
    }
  }

  async forecastBudgetExceedance(teamId: string, expenses: any[], budget: number, currentSpending: number): Promise<{ success: boolean; forecast?: any; error?: string }> {
    try {
      if (!this.openai) {
        this.logger.warn('OpenAI API key not configured, skipping forecast generation');
        return { success: false, error: 'AI service not configured' };
      }

      if (!expenses || expenses.length < 5) {
        return { success: false, error: 'Insufficient data for forecasting' };
      }

      // Calculate spending trends
      const monthlySpending = this.calculateMonthlySpending(expenses);
      const averageMonthlySpending = monthlySpending.reduce((sum, month) => sum + month.amount, 0) / monthlySpending.length;
      
      const prompt = `
        Based on historical spending data, predict if this team will exceed their budget.
        
        Team Budget: $${budget}
        Current Spending: $${currentSpending}
        Remaining Budget: $${budget - currentSpending}
        
        Monthly Spending History:
        ${monthlySpending.map(month => 
          `- ${month.month}: $${month.amount}`
        ).join('\n')}
        
        Average Monthly Spending: $${averageMonthlySpending.toFixed(2)}
        
        Provide forecast in JSON format:
        {
          "willExceedBudget": true/false,
          "confidence": 0.0-1.0,
          "predictedOverspend": amount_in_dollars,
          "monthsToExceed": number_of_months,
          "recommendations": ["recommendation1", "recommendation2"]
        }
      `;

      const response = await this.queueRequest(() =>
        this.openai.chat.completions.create({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "system",
              content: "You are a financial forecasting expert. Always respond with valid JSON format."
            },
            {
              role: "user",
              content: prompt
            }
          ],
          max_tokens: 300,
          temperature: 0.2,
        })
      );

      const content = response.choices[0].message.content;
      if (!content) {
        return { success: false, error: 'No response from AI' };
      }
      const forecast = JSON.parse(content);
      
      return {
        success: true,
        forecast: {
          ...forecast,
          averageMonthlySpending,
          currentUtilization: (currentSpending / budget) * 100
        }
      };
    } catch (error) {
      this.logger.error('Error forecasting budget exceedance:', error);
      return { success: false, error: error.message };
    }
  }

  private calculateMonthlySpending(expenses: any[]): { month: string; amount: number }[] {
    const monthlyData: Record<string, number> = {};
    
    expenses.forEach(expense => {
      const month = new Date(expense.date).toISOString().substring(0, 7); // YYYY-MM
      monthlyData[month] = (monthlyData[month] || 0) + expense.amount;
    });
    
    return Object.entries(monthlyData)
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }
}
