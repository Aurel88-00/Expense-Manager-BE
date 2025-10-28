import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import { Team } from '../../domains/team/schemas/team.schema';
import { Expense } from '../../domains/expense/schemas/expense.schema';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private resend: Resend;
  private from: string;
  private requestQueue: Promise<any> = Promise.resolve();
  private lastRequestTime = 0;
  private readonly MIN_REQUEST_INTERVAL = 100; 

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get<string>('email.resendApiKey');
    if (apiKey) {
      this.resend = new Resend(apiKey);
      this.from = 'Expense Management System <noreply@resend.dev>'; 
    }
  }

  private async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelay = 1000
  ): Promise<T> {
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

        return await fn();
      } catch (error: any) {
        const isRateLimitError =
          error?.statusCode === 429 ||
          error?.message?.includes('rate limit') ||
          error?.message?.includes('Too many requests');
        
        const isLastAttempt = attempt === maxRetries;

        if (isRateLimitError && !isLastAttempt) {
          const delay = baseDelay * Math.pow(2, attempt) + Math.random() * 1000;
          this.logger.warn(
            `Email rate limit hit, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`
          );
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
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

  async sendBudgetAlert(team: Team, alertType: 'eighty_percent' | 'hundred_percent'): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      if (!this.resend) {
        this.logger.warn('Resend API key not configured, skipping email');
        return { success: false, error: 'Email service not configured' };
      }

      const { name, budget, currentSpending, members } = team;
      const utilization = (currentSpending / budget) * 100;
      
      let subject: string, htmlContent: string;
      
      if (alertType === 'eighty_percent') {
        subject = `Budget Alert: ${name} has reached 80% of budget`;
        htmlContent = this.generateEightyPercentAlertHTML(name, budget, currentSpending, utilization);
      } else {
        subject = `URGENT: ${name} has exceeded budget limit`;
        htmlContent = this.generateHundredPercentAlertHTML(name, budget, currentSpending, utilization);
      }

      const emails = members.map(member => member.email);
      
      const result = await this.queueRequest(() =>
        this.resend.emails.send({
          from: this.from,
          to: emails,
          subject,
          html: htmlContent,
        })
      );

      this.logger.log('Budget alert email sent successfully');
      return { success: true, result };
    } catch (error) {
      this.logger.error('Error sending budget alert email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendExpenseApprovalNotification(expense: Expense, approved: boolean): Promise<{ success: boolean; result?: any; error?: string }> {
    try {
      if (!this.resend) {
        this.logger.warn('Resend API key not configured, skipping email');
        return { success: false, error: 'Email service not configured' };
      }

      const { submittedBy, amount, description } = expense;
      const subject = approved 
        ? `Expense Approved: $${amount} - ${description}`
        : `Expense Rejected: $${amount} - ${description}`;
      
      const htmlContent = this.generateExpenseNotificationHTML(expense, approved);
      
      const result = await this.queueRequest(() =>
        this.resend.emails.send({
          from: this.from,
          to: [submittedBy.email],
          subject,
          html: htmlContent,
        })
      );

      this.logger.log('Expense notification email sent successfully');
      return { success: true, result };
    } catch (error) {
      this.logger.error('Error sending expense notification email:', error);
      return { success: false, error: error.message };
    }
  }

  private generateEightyPercentAlertHTML(teamName: string, budget: number, currentSpending: number, utilization: number): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #ff9800; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .alert { background-color: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .stats { background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Budget Alert</h1>
          </div>
          <div class="content">
            <h2>Team: ${teamName}</h2>
            <div class="alert">
              <strong>Your team has reached 80% of its budget allocation!</strong>
            </div>
            <div class="stats">
              <h3>Budget Status:</h3>
              <p><strong>Total Budget:</strong> $${budget.toLocaleString()}</p>
              <p><strong>Current Spending:</strong> $${currentSpending.toLocaleString()}</p>
              <p><strong>Utilization:</strong> ${utilization.toFixed(1)}%</p>
              <p><strong>Remaining:</strong> $${(budget - currentSpending).toLocaleString()}</p>
            </div>
            <p>Please review your expenses and consider budget constraints for future spending.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from the Expense Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateHundredPercentAlertHTML(teamName: string, budget: number, currentSpending: number, utilization: number): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f44336; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .alert { background-color: #ffebee; border: 1px solid #ffcdd2; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .stats { background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>URGENT: Budget Exceeded</h1>
          </div>
          <div class="content">
            <h2>Team: ${teamName}</h2>
            <div class="alert">
              <strong>Your team has EXCEEDED its budget allocation!</strong>
            </div>
            <div class="stats">
              <h3>Budget Status:</h3>
              <p><strong>Total Budget:</strong> $${budget.toLocaleString()}</p>
              <p><strong>Current Spending:</strong> $${currentSpending.toLocaleString()}</p>
              <p><strong>Utilization:</strong> ${utilization.toFixed(1)}%</p>
              <p><strong>Over Budget By:</strong> $${(currentSpending - budget).toLocaleString()}</p>
            </div>
            <p><strong>Immediate action required:</strong> Please review all pending expenses and contact management for budget approval.</p>
          </div>
          <div class="footer">
            <p>This is an automated message from the Expense Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }

  private generateExpenseNotificationHTML(expense: Expense, approved: boolean): string {
    const { amount, description, category, date, submittedBy } = expense;
    const statusColor = approved ? '#4caf50' : '#f44336';
    const statusText = approved ? 'Approved' : 'Rejected';
    
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: ${statusColor}; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .expense-details { background-color: white; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Expense ${statusText}</h1>
          </div>
          <div class="content">
            <h2>Hello ${submittedBy.name},</h2>
            <p>Your expense has been <strong>${statusText.toLowerCase()}</strong>.</p>
            <div class="expense-details">
              <h3>Expense Details:</h3>
              <p><strong>Amount:</strong> $${amount.toLocaleString()}</p>
              <p><strong>Description:</strong> ${description}</p>
              <p><strong>Category:</strong> ${category}</p>
              <p><strong>Date:</strong> ${new Date(date).toLocaleDateString()}</p>
            </div>
            ${approved 
              ? '<p>This expense has been approved and will be processed for reimbursement.</p>'
              : '<p>This expense has been rejected. Please contact your manager for more information.</p>'
            }
          </div>
          <div class="footer">
            <p>This is an automated message from the Expense Management System</p>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}
