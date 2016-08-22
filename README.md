#Koa one time csrf

One time csrf middleware fro koa2

## Requirements

- Node v6.0+
- redis

## Workflow
- `npm install`

## Use
- `app.use(require('koa-one-time-csrf')(opts))`
- `ctx.body = await ctx.getNewCsrf();`

## Options


    const defaultOptions = {
      maxAge: 1000 * 60 * 60, //tokens store in reids max age
      prefix: 'afcsrf', //redis key prefix
      redis: { //redis config
        host: '127.0.0.1',
        prot: 6379,
        db: 0,
      },
    };
