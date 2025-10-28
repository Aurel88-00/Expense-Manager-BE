## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g @nestjs/mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.


##Project: Expense Management System

Goal: To create a secure, scalable, and intelligent expense management API and dashboard with real-time budget monitoring and AI-powered categorization.

## 1. Data Design and Schema

We will use simple, normalized schemas. To ensure efficient querying and data consistency, we will not store calculated totals (like totalSpent) directly on the Team object. Instead, we compute them on demand, especially when triggering budget alerts, which minimizes data inconsistency risks.

# Schema 1: Team & Team Member
We will highlight the schema structures below, but they are also accessible in the Swagger documentation.
- Team Schema
```
@Schema()
export class Team {
  //In mongoDB we always have an _id property which servers as a unique identifier for the document
  @Prop({ required: true, trim: true, maxlength: 100 }) // Gives details about the document property like type, is required etc.
  name: string;

  @Prop({ required: true, min: 0 })
  budget: number;

  @Prop({ type: [TeamMemberSchema], required: true })
  members: TeamMemberSchema[];

  @Prop({ default: 0 })
  currentSpending: number;

  @Prop({
    type: {
      eightyPercentSent: { type: Boolean, default: false },
      hundredPercentSent: { type: Boolean, default: false },
    },
    default: () => ({
      eightyPercentSent: false,
      hundredPercentSent: false,
    }),
  })
  budgetAlerts: {
    eightyPercentSent: boolean;
    hundredPercentSent: boolean;
  };
}
```
- Team Member Schema 
```
@Schema({ timestamps: true })
export class TeamMemberSchema {
  @Prop({ required: true, trim: true, maxlength: 100 })
  name: string;

  @Prop({ required: true, trim: true, lowercase: true })
  email: string;

  @Prop({ enum: MemberRole, default: MemberRole.MEMBER })
  role: MemberRole;
}
```
# Schema 2: Expense
```
@Schema({ timestamps: true })
export class Expense {
  @Prop({ type: Types.ObjectId, ref: 'Team', required: true })
  team: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 500 })
  description: string;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ enum: ExpenseCategory, required: true })
  category: ExpenseCategory; // References an enumerator (a group of static alphanumeric data)

  @Prop({ enum: ExpenseCategory })
  aiSuggestedCategory: ExpenseCategory;

  @Prop({ enum: ExpenseStatus, default: ExpenseStatus.PENDING })
  status: ExpenseStatus;

  @Prop({ type: SubmitterSchema, required: true })
  submittedBy: SubmitterSchema; // References another schema, meaning it's structured after another document

  @Prop({ type: ApprovedBySchema })
  approvedBy: ApprovedBySchema;

  @Prop({
    type: {
      filename: String,
      originalName: String,
      mimetype: String,
      size: Number,
    },
  })
  receipt: {
    filename: string;
    originalName: string;
    mimetype: string;
    size: number;
  };

  @Prop({ required: true })
  date: Date;

  @Prop({ default: false })
  isDuplicate: boolean;

  @Prop()
  duplicateReason: string;
}
```
## 2. Architecture (DDD - Domain-driven design)
Our API follows a clean, ddd including three main layers: controllers, service, and data access layer, ensuring clear separation of concerns.

* Controller Layer (API Routes): Handles HTTP requests, authentication, and input validation. Calls the Service Layer.

* Service Layer (Business Logic): Contains all core logic (e.g., createExpense, calculateBudget, checkBudgetAndAlert). This layer coordinates interactions between the Data Access Layer and external services.

* Data Access Layer (DAL): Handles direct CRUD operations on the database.

## 3. External Service Integration Points
Implements two external services, one to smartly handle email notifications when certain budget expenditure criteria are met, and an AI service to predict
teams' expenditure patterns and future management issues.
The AI is a free tier and has a rate limiter issue, but if you provide your billing information, it will work!


## Environment variables 
In order to run the application, you should set up your local environment variables. 
* MongoDB connection URI, to connect to your own cluster
* Resend API key, obtained on their website, and in the app we have used their provider email, but in case of any issue, you can add a specific domain for your service
* OpenAI API key, obtained on their website, just like the email one and you can provide your billing information if necessary
