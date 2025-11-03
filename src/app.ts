import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { notFound, onError } from './modules/common/middlewares/error';
import { corsMiddleware } from './modules/config/cors';
import { router } from './routes';

export const app = express();
app.use(helmet());
app.use(morgan('dev'));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(corsMiddleware);
app.use('/api', router);
app.use(notFound);
app.use(onError);
