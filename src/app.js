import express from 'express';
import path from 'path';
import cookieParser from 'cookie-parser';
import logger from 'morgan';
import indexRouter from './routes/index';
import dotenv from 'dotenv'
import redis from 'redis'
import * as authMiddleware from './middlewares/auth'
dotenv.config()

const {redis_port, redis_host} = process.env
export const redisClient = redis.createClient({ host: redis_host || 'localhost', port: redis_port || 6379 });

redisClient.on('ready', function () {
  console.log("Redis is ready");
});

redisClient.on('error', function () {
  console.log("Error in Redis");
});

const app = express();


app.use(logger('dev'));
app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "http://localhost:9000");
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET,HEAD,OPTIONS,POST,PUT");
  // res.header("Access-Control-Allow-Headers, Origin,Accept, X-Requested-With, Content-Type, Access-Control-Request-Method, Access-Control-Request-Headers");
  // res.header("Access-Control-Allow-Origin", "http://localhost:9000");
  res.header("Access-Control-Allow-Headers", "Authorization, Access-Control-Allow-Credentials, Access-Control-Allow-Origin, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Request-Method, Access-Control-Request-Headers");
  next();
});
app.use(authMiddleware.mmlsAuth)
app.use(authMiddleware.googleAuth)

// app.use(cors(corsOptions))
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, '../public')));

app.use('/', indexRouter);

// scrapeAllInformation()
import _ from './jobs'


export default app;

