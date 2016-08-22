const test = require('ava');
const Koa = require('koa');
const router = require('koa-router')();
const chai = require('chai');
chai.use(require('chai-http'));
const bodyParser = require('koa-bodyparser');

test.before(t => {

  const csrfKey = 'csrfkey' + new Date().getTime();
  const app = new Koa();

  app.use(bodyParser());

  app.use(async (ctx, next) => {
    //mock session
    ctx.session = {
      _CSRFKEY: csrfKey,
    };
    await next();
  });

  app.use(require('../dist/index')());

  router.get('/api/test', ctx => {
    ctx.body = 111;
  });

  router.get('/api/csrf', async ctx => {
    ctx.body = await ctx.getNewCsrf();
  });

  router.post('/api/verify', async ctx => {
    ctx.body = 'ok';
  });

  app.use(router.routes());

  app.listen('8099', () => {
    console.log('server start at 8099');
  });
});

test('http test', async t => {
  const agent = chai.request.agent('http://localhost:8099');
  const word = (await agent.get('/api/test')).text;
  t.is(word, '111');
});

test('post with csrf', async t => {
  const agent = chai.request.agent('http://localhost:8099');

  const csrf = (await agent.get('/api/csrf')).text;

  const word = (await agent.post('/api/verify').set({ 'x-csrf-token': csrf })).text;

  t.is(word, 'ok');

  t.throws(agent.post('/api/verify').send({ '_csrf': csrf }));
});


