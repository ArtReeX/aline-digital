/* eslint-disable prefer-destructuring */
/* eslint-disable require-atomic-updates */
/* eslint-disable no-undef */
const Coa = require('koa');
const Router = require('koa-router');
const mount = require('koa-mount');
const koaBody = require('koa-body');
const mysql = require('mysql2');
const md4 = require('js-md4');
const redis = require('async-redis');
const config = require('./config');

const app = new Coa();
const router = new Router();
const mysqlClient = mysql.createConnection(config.mysql);
const redisClient = redis.createClient(config.redis);

app.use(koaBody());

// route declaration
router.get('/books', async (ctx) => {
  try {
    let result;

    let query = 'SELECT * FROM books';
    if (ctx.query.sort) query += `ORDER BY ${ctx.query.sort}`;

    if (await redisClient.get(md4(query))) {
      result = JSON.parse(await redisClient.get(md4(query)));
    } else {
      result = (await mysqlClient.promise().query(query))[0].filter((book) => {
        if (ctx.query.id && ctx.query.id !== book.id) return false;
        if (ctx.query.title && ctx.query.title !== book.title) return false;
        if (ctx.query.date && ctx.query.date !== book.date) return false;
        if (ctx.query.autor && ctx.query.autor !== book.autor) return false;
        if (ctx.query.description && ctx.query.description !== book.description) return false;
        if (ctx.query.image && ctx.query.image !== book.image) return false;

        return true;
      });
      await redisClient.set(md4(query), JSON.stringify(result));
    }

    ctx.body = result;
  } catch (error) {
    ctx.status = 400;
    ctx.body = error.message;
  }
});
router.post('/books', async (ctx) => {
  try {
    const {
      title, date, autor, description, image,
    } = ctx.request.body;

    await mysqlClient
      .promise()
      .execute(
        'INSERT INTO books(title, date, autor, description, image) VALUES(?, ?, ?, ?, ?)',
        [title, date, autor, description, image],
      );
    await redisClient.del(md4(query));

    ctx.status = 201;
  } catch (error) {
    ctx.status = 400;
    ctx.body = error.message;
  }
});

app.use(mount('/api', router.middleware()));
app.listen(process.env.PORT || 80);
