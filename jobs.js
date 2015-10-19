'use strict';
const mongoose    = require('mongoose');
const crypto      = require('crypto');
const io          = require('redis.io');
const jobs        = io.createQueue({
  prefix: 'q',
  disableSearch: true,
  jobEvents: false,
  redis: {
    host: process.env.redis
  }
});
const rest        = require('restler');
const xml2js      = require('xml2js');
const fs          = require('fs');
const moment      = require('moment');
const Agenda      = require('agenda');
const _           = require('lodash');
const async       = require('async');
const cc          = require('coupon-code');
const push        = require('pushover-notifications');
const rollbar     = require('rollbar');
const cheerio     = require('cheerio');
const vm          = require('vm');
const path        = require('path');
const util        = require('util');
const winston     = require('winston');
const Twit        = require('twit');
const paypal      = require('paypal-rest-sdk');
const redirect    = process.env.NODE_ENV === 'development' ?
        'http://10.38.38.200' : 'https://oneinvites.com';

let p = new push({
  user: process.env.PUSHOVER_USER,
  token: process.env.PUSHOVER_TOKEN
});

const T = new Twit({
  consumer_key        : process.env.TWITTER_CONSUMER_KEY,
  consumer_secret     : process.env.TWITTER_CONSUMER_KEY_SECRET,
  access_token        : process.env.TWITTER_ACCESS_TOKEN,
  access_token_secret : process.env.TWITTER_ACCESS_TOKEN_SECRET
});

String.prototype.cleanup = function() {
  return this.toLowerCase().replace(/[^a-zA-Z0-9]+/g, '');
};

rollbar.init(process.env.rollbar);

var logger;

if (process.env.NODE_ENV === 'development') {
  logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)()
    ]
  });
} else {
  require('le_node');
  logger = new (winston.Logger)({
    transports: [
      new winston.transports.Logentries({
        token: process.env.logentries
      })
    ]
  });
}

paypal.configure({
  'mode': process.env.NODE_ENV === 'development' ? 'sandbox' : 'live',
  'client_id': process.env.PAYPALCLIENTID,
  'client_secret': process.env.PAYPALSECRET
});

const modelsPath = __dirname + '/models';
fs.readdirSync(modelsPath).forEach(function(file) {
  if (~file.indexOf('js')) {
    require(modelsPath + '/' + file);
  }
});

let Mails = mongoose.model('Mails');
let EmailsAccounts = mongoose.model('EmailsAccounts');
let EmailsForInvites = mongoose.model('EmailsForInvites');
let Payments = mongoose.model('Payments');

jobs.promote(1500, 1);

jobs.watchStuckJobs();

setInterval(function() {
  io.Job.rangeByState('complete', 0, 100, 'asc', function(err, jobs) {
    jobs.forEach(function(job) {
      job.remove(function(){
        log('removed ' + job.id );
      });
    });
  });
}, 1000 );

let agenda = new Agenda({
  db: {
    address: process.env.mongo + '/oneinvites'
  }
});

agenda.define('post twitter', {
  concurrency: 1
}, (job, done) => {
  if (process.env.NODE_ENV !== 'development') {
    EmailsAccounts.count({
      type: 1,
      password: {
        $exists: false
      },
      sell: false,
      invite: false
    }).exec((err, count) => {
      if (err) {
        log(err, 'error');
        done();
      } else {
        if (count !== 0) {
          T.post('statuses/update', {
            status: count + ' accounts with GLOBAL(not India) invites\noneinvites.com for only 2$\ninvites.oneplus.net #oneplus2invite #OnePlus2'
          }, (err, data, response) => {
            if (err) {
              log(err, 'error');
              done();
            } else {
              log(data);
              done();
            }
          });
        } else {
          done();
        }
      }
    });
  } else {
    done();
  }
});

agenda.define('check emails for invites', {
  concurrency: 1
}, (job, done) => {
  Mails.find({subject:'You’re invited'}, (err, emails) => {
    if (err) {
      log(err, 'error');
      done();
    } else {
      async.each(emails, function(email, callback) {
        EmailsForInvites.findOne({mail:email.to}, (err, em) => {
          if (err) {
            log(err, 'error');
            callback();
          } else {
            EmailsAccounts.findOne({email:em.mail}, (err, acc) => {
              if (err) {
                log(err, 'error');
                callback();
              } else {
                if (_.isNull(acc)) {
                  let account = new EmailsAccounts({
                    email        : em.mail,
                    urlhash      : em.hash,
                    invite       : false,
                    sell         : false,
                    start        : moment(email.date).unix(),
                    end          : moment(email.date).add(24, 'h').unix(),
                    type         : 1,
                    updated_at   : new Date(),
                    created_at   : new Date()
                  });
                  account.save((err) => {
                    if (err) {
                      log(err, 'error');
                      callback();
                    } else {
                      log('Create ' + em.mail);
                      callback();
                    }
                  });
                } else {
                  callback();
                }
              }
            });
          }
        });
      }, function(e) {
        if (e) {
          log(e, 'error');
          done();
        } else {
          log('Check all emails for invites');
          done();
        }
      });
    }
  });
});

agenda.define('check payment', {
  concurrency: 1,
  lockLifetime: 5000
}, (job, done) => {
  Payments.find({
    state:'created'
  }, (err, payments) => {
    if (err) {
      log(err, 'error');
      done();
    } else {
      if (!_.isEmpty(payments)) {
        async.each(payments, (payment, callback) => {
          let paymentId = payment.paymentId;

          paypal.payment.get(paymentId, (error, paym) => {
            if (error) {
              log(error);
              callback();
            } else {
              log('Get Payment Response');
              log(JSON.stringify(paym));
              Payments.findOne({
                paymentId: paymentId
              }, (err, pay) => {
                pay.state = paym.state;
                if (!_.isUndefined(paym.payer)) {
                  pay.email = paym.payer['payer_info'].email;
                }
                pay.notes = JSON.stringify(paym);
                pay.updated_at = new Date();
                pay.save(err => {
                  if (err) {
                    log(err, 'error');
                    callback();
                  } else {
                    log('Check ' + paymentId);
                    callback();
                  }
                });
              });
            }
          });
        }, function(e) {
          if (e) {
            log(e, 'error');
            done();
          } else {
            log('Check all paypal');
            done();
          }
        });
      } else {
        done();
      }
    }
  });
});

agenda.define('check old invites', {
  concurrency: 1
}, (job, done) => {
  EmailsAccounts.find({
    type : 1,
    end : {
      $lt: moment().add(1, 'h').unix()
    }
  }, (err, accounts) => {
    if (err) {
      log(err, 'error');
      done();
    } else {
      async.each(accounts, function(account, callback) {
        EmailsAccounts.findOne({
          _id: account._id
        }, (err, acc) => {
          acc.type = 3;
          acc.save((err) => {
            if (err) {
              log(err, 'error');
              callback();
            } else {
              log('Type 1 -> 3 ' + acc.email);
              callback();
            }
          });
        });
      }, function(e) {
        if (e) {
          log(e, 'error');
          done();
        } else {
          log('Check all old invites');
          done();
        }
      });
    }
  });
});

agenda.every('5 seconds', 'check payment');

agenda.every('5 minutes', 'check old invites');

agenda.every('1 hour', 'check emails for invites');

agenda.every('1 hour', 'post twitter');

agenda.start();

jobs.process('paypal', function(job, done) {
  var domain = require('domain').create();
  domain.on('error', function(err) {
    log(err);
    setImmediate(done);
  });
  domain.run(function() {
    let execute_payment_json = {
      'payer_id': job.data.PayerID,
      'transactions': [{
        'amount': {
          'currency': 'USD',
          'total': '2.00'
        }
      }]
    };

    let paymentId = job.data.paymentId;

    paypal.payment.execute(paymentId, execute_payment_json, (error, pa) => {
      if (error) {
        log(error.response, 'error');
        done();
      } else {
        log('Get Payment Response');
        log(JSON.stringify(pa));
        Payments.findOne({paymentId: job.data.paymentId}, (err, paym) => {
          paym.state = pa.state;
          paym.notes = JSON.stringify(pa);
          paym.save((err) => {
            if (err) {
              log(err, 'error');
              done();
            } else {
              log('Post paypal');
              done();
            }
          });
        });
      }
    });
  });
});

jobs.process('mail', function(job, done) {
  var domain = require('domain').create();
  domain.on('error', function(err) {
    log(err);
    setImmediate(done);
  });
  domain.run(function() {
    var M = new Mails({
      from       : job.data.from,
      to         : job.data.to,
      subject    : job.data.subject,
      date       : job.data.date,
      html       : job.data.html,
      text       : job.data.text
    });
    M.save(function(err, m) {
      if (err) {
        log('Письмо ' + job.data.to + ' Ошибка: ' + err, 'error');
        setImmediate(done);
      } else {
        log('Письмо ' + job.data.to + ' сохранено');
        if (job.data.from === 'invites@oneplus.net' ||
            job.data.from === 'me@pomeo.me') {
          let msg = {
            title: 'invites@oneplus.net',
            message: 'New invite to ' + job.data.to
          };
          p.send(msg, function(err, result) {
            if (err) {
              log(err, 'error');
            } else {
              log(result);
            }
          });
        }
        if ((job.data.subject === 'Confirm your email') ||
            (job.data.subject === 'Account Confirmation')) {
          var $ = cheerio.load(job.data.html);
          log($('a').first().text());
          jobs.create('clickConfirm', {
            to: m.to,
            url: $('a').first().text()
          }).delay(10000).priority('normal').removeOnComplete(true).save();
          setImmediate(done);
        } else {
          setImmediate(done);
        }
      }
    });
  });
});

jobs.process('clickConfirm', function(job, done) {
  var domain = require('domain').create();
  domain.on('error', function(err) {
    log(err);
    setImmediate(done);
  });
  domain.run(function() {
    rest.get(job.data.url, {
      //headers: {'User-Agent': 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'},
      headers: {'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/43.0.2357.132 Safari/537.36'},
      timeout: 20000
    }).once('timeout', function(ms){
      log('Ошибка: Таймаут ' + ms + ' ms', 'error');
      jobs.create('clickConfirm', {
        to: job.data.to,
        url: job.data.url
      }).delay(60000).priority('low').removeOnComplete(true).save();
      setImmediate(done);
    }).once('error',function(err, response) {
      log('Ошибка: ' + err, 'error');
      setImmediate(done);
    }).once('abort',function() {
      log('Ошибка: Abort', 'error');
      setImmediate(done);
    }).once('fail',function(data, response) {
      log('Ошибка: ' + JSON.stringify(data), 'error');
      setImmediate(done);
    }).once('success',function(data, response) {
      log('Подтверждена почта ' + job.data.to);
      setImmediate(done);
    });
  });
});

mongoose.connect('mongodb://' + process.env.mongo + '/oneinvites', {
  autoIndex: process.env.NODE_ENV !== 'production'
});

function log(logMsg, logType) {
  if (logMsg instanceof Error) logger.error(logMsg.stack);
  if (!_.isUndefined(logType)) {
    logger.log(logType, logMsg);
  } else {
    logger.info(logMsg);
  }
}

// server with small memory, need manual release
setInterval(function () {
  global.gc();
  console.log((process.memoryUsage().rss / 1024 / 1024).toFixed(2) + 'Mb');
}, 60000);
