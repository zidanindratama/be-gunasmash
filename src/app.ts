import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import morgan from 'morgan';

import { notFound, onError } from './modules/common/middlewares/error.js';
import { corsMiddleware } from './modules/config/cors.js';
import { router } from './routes.js';

const app = express();

app.use(helmet());
app.use(morgan('dev'));
app.use(compression());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(corsMiddleware);

app.use('/', router);

app.use(notFound);
app.use(onError);

export default app;
