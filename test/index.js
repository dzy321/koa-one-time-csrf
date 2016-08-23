const test = require('ava');
const Koa = require('koa');
const router = require('koa-router')();
const chai = require('chai');
chai.use(require('chai-http'));
const bodyParser = require('koa-bodyparser');
const session = require('koa-session');
const convert = require('koa-convert');

test.before(t => {

  const app = new Koa();

  app.use(bodyParser());

  app.keys = ['terminus herd wtf'];

  app.use(convert(session({
    domain: 'localhost',
    key: 'sessoinId',
    maxAge: 1000 * 10,
  }, app)));

  app.use(require('../dist/index')());

  router.get('/api/test', ctx => {
    ctx.body = 111;
  });

  router.get('/api/csrf', async ctx => {
    ctx.body = await ctx.getCsrf();
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

  const res = await agent.get('/api/csrf');

  const csrf = res.text;

  const word = (await agent.post('/api/verify').set({ 'x-csrf-token': csrf })).text;

  t.is(word, 'ok');

  t.throws(agent.post('/api/verify').send({ '_csrf': csrf }));
});


test('post with keep csrf', async t => {
  const agent = chai.request.agent('http://localhost:8099');

  const res = await agent.get('/api/csrf');

  const csrf = res.text;

  const word = (await agent.post('/api/verify').set({ 'x-csrf-token': csrf, 'x-csrf-token-keep': '1' })).text;

  t.is(word, 'ok');

  const word1 = (await agent.post('/api/verify').set({ 'x-csrf-token': csrf, 'x-csrf-token-keep': '1' })).text;

  t.is(word1, 'ok');
});

function sleep(time) {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve();
    }, time);
  });
}

test('expire csrf', async t=> {
  const agent = chai.request.agent('http://localhost:8099');
  const res = await agent.get('/api/csrf');
  const csrf = res.text;
  await sleep(10000);
  t.throws(agent.post('/api/verify').send({ '_csrf': csrf }));
});
