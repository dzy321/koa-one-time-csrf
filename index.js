const _ = require('lodash');
const Redis = require('ioredis');
const uid = require('uid-safe');

exports = module.exports = opts => {
  const defaultOptions = {
    maxAge: 1000 * 60 * 60,
    prefix: 'afcsrf',
    maxTokens: 10,
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
      const result = await this.redis.multi()
        .zadd(key, `${csrf}:${secret}`)
        .zrange(key, 0, -1)
        .exec();
      if (result) {
        const set = result[1][1];
        if (set.length > opts.maxTokens) {
          for (let i = 0, len = set.length - opts.maxTokens; i < len; i++) {
            await this.redis.zrem(key, set[i]);
          }
        }
        await this.redis.expire(key, opts.maxAge);
        return true;
      }
      return false;
    }

    async verify(csrfKey, csrf) {
      const key = `${opts.prefix}:${csrfKey}`;
      const set = await this.redis.zrange(key, 0, -1);
      const tiket = _.find(set, t => t.indexOf(`${csrf}:`) === 0);
      if (tiket) {
        await this.redis.zrem(key, tiket);
        return true;
      }
      return false;
    }
  }

  opts = _.defaultsDeep(opts, defaultOptions);

  const store = new RedisStore();

  const define = ctx => {
    ctx.getNewCsrf = async () => {
      /**
       * generate token
       */
      let csrfKey = ctx.session._CSRFKEY;
      if (!csrfKey) {
        csrfKey = ctx.session._CSRFKEY = uid.sync(24);
      }
      const secret = tokens.secretSync();
      const csrf = tokens(secret);
      const result = await store.set(csrfKey, secret, csrf);
      if (!result) throw new Error('Get csrf error!');
      return csrf;
    };

    ctx.assertCSRF = ctx.assertCsrf = async (csrf) => {
      const csrfKey = ctx.session._CSRFKEY;
      if (!csrfKey) {
        ctx.throw(403, 'secret is missing');
        return false;
      }
      const result = await store.verify(csrfKey, csrf);
      if (!result) {
        ctx.throw(403, 'invalid csrf token');
        return false;
      }
      return true;
    };
  };

  return async (ctx, next) => {
    define(ctx);
    await next();
  };
};
