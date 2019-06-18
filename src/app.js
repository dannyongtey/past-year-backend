import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import indexRouter from './routes/index';
import dotenv from 'dotenv'
import redis from 'redis'

export const redisClient = redis.createClient({ host: 'localhost', port: 6379 });

redisClient.on('ready', function () {
    console.log("Redis is ready");
});

redisClient.on('error', function () {
    console.log("Error in Redis");
});

dotenv.config()
const app = express();

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/', indexRouter);

export default app;

