const _ = require('lodash');
const Redis = require('ioredis');
const uid = require('uid-safe');

exports = module.exports = opts => {
  const defaultOptions = {
    maxAge: 1000 * 60 * 60,
    prefix: 'afcsrf',
    redis: {
      host: '127.0.0.1',
      prot: 6379,
      db: 0,
    },
  };

  const tokens = require('csrf')(opts);

  class RedisStore {
    constructor() {
      this.redis = new Redis(opts.redis);
    }

    async set(csrfKey, secret, csrf) {
      const key = `${opts.prefix}:${csrfKey}`;
      await this.redis.sadd(key, `${csrf}:${secret}`);
      await this.redis.expire(key, opts.maxAge);
      return true;
    }

    async verify(csrfKey, csrf) {
      const key = `${opts.prefix}:${csrfKey}`;
      const set = await this.redis.smembers(key);
      const tiket = _.find(set, t => t.indexOf(`${csrf}:`) === 0);
      if (tiket) {
        await this.redis.srem(key, tiket);
        return true;
      }
      return false;
    }
  }

  opts = _.defaultsDeep(opts, defaultOptions);

  const store = new RedisStore();

  const define = ctx => {

    ctx.getCsrf = async function () {
      /**
       * generate token
       */
      let csrfKey = this.session.CSRFKEY;
      if (!csrfKey) {
        csrfKey = uid.sync(24);
        this.session.CSRFKEY = csrfKey;
      }
      const secret = tokens.secretSync();
      const csrf = tokens.create(secret);
      const result = await store.set(csrfKey, secret, csrf);
      if (!result) throw new Error('Get csrf error!');
      return csrf;
    };

    ctx.assertCSRF = ctx.assertCsrf = async function (body) {
      const csrfKey = this.session.CSRFKEY;
      if (!csrfKey) {
        this.throw(403, 'secret is missing');
        return false;
      }
      const csrf = (body && body._csrf)
        || (this.query && this.query._csrf)
        || (this.get('x-csrf-token'))
        || (this.get('x-xsrf-token'))
        || body;
      if (!csrf) {
        this.throw(403, 'token is missing');
        return false;
      }
      const result = await store.verify(csrfKey, csrf);
      if (!result) {
        this.throw(403, 'invalid csrf token');
        return false;
      }
      return true;
    };
  };

  const middleware = async (ctx, next) => {
    if (ctx.method === 'GET'
      || ctx.method === 'HEAD'
      || ctx.method === 'OPTIONS') {
      await next();
      return;
    }
    if (await ctx.assertCSRF(ctx.request.body)) {
      await next();
    }
  };

  return async (ctx, next) => {
    define(ctx);
    await middleware(ctx, next);
  };
};
