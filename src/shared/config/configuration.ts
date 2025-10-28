export default () => ({
  port: parseInt(process.env.PORT || '5000', 10),
  database: {
    uri: process.env.MONGODB_URI,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    expiresIn: '7d',
  },
  email: {
    resendApiKey: process.env.RESEND_API_KEY,
  },
  ai: {
    openaiApiKey: process.env.OPENAI_API_KEY,
  },
  environment: process.env.NODE_ENV || 'development',
});
