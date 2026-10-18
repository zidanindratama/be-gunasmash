import dotenv from 'dotenv';
dotenv.config();

function required(key: string, source: NodeJS.ProcessEnv) {
  const v = source[key];
  if (!v) throw new Error(`Missing env ${key}`);
  return v;
}

export function loadEnv(source: NodeJS.ProcessEnv = process.env) {
  return {
    NODE_ENV: source.NODE_ENV || 'development',
    PORT: source.PORT || '4000',
    DATABASE_URL: required('DATABASE_URL', source),
    JWT_ACCESS_SECRET: required('JWT_ACCESS_SECRET', source),
    JWT_REFRESH_SECRET: required('JWT_REFRESH_SECRET', source),
    JWT_ACCESS_EXPIRES: source.JWT_ACCESS_EXPIRES || '15m',
    JWT_REFRESH_EXPIRES: source.JWT_REFRESH_EXPIRES || '7d',
    CLOUDINARY_CLOUD_NAME: required('CLOUDINARY_CLOUD_NAME', source),
    CLOUDINARY_API_KEY: required('CLOUDINARY_API_KEY', source),
    CLOUDINARY_API_SECRET: required('CLOUDINARY_API_SECRET', source),
    CORS_WHITELIST: source.CORS_WHITELIST || 'localhost,vercel.app',
  };
}

export const env = loadEnv();
