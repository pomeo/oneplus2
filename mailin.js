var mailin = require('mailin');

mailin.start({
  host: '10.3.140.1',
  port: 2525,
  tmp: 'tmp',
  webhook: 'http://localhost:3000/webhook',
  disableWebhook: false,
});
