var mailin = require('mailin');

mailin.start({
  host: '127.0.0.1',
  port: 2525,
  tmp: 'tmp',
  webhook: 'http://localhost:3000/webhook',
  disableWebhook: false,
});
