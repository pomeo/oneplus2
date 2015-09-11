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
// const Browser     = require('zombie');
const rollbar     = require('rollbar');
const cheerio     = require('cheerio');
const vm          = require('vm');
const path        = require('path');
const util        = require('util');
const winston     = require('winston');

let p = new push({
  user: process.env.PUSHOVER_USER,
  token: process.env.PUSHOVER_TOKEN
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

const modelsPath = __dirname + '/models';
fs.readdirSync(modelsPath).forEach(function(file) {
  if (~file.indexOf('js')) {
    require(modelsPath + '/' + file);
  }
});

let Mails = mongoose.model('Mails');

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
          }).delay(2000).priority('normal').removeOnComplete(true).save();
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
      timeout: 2000
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
      log(response);
      log('Подтверждена почта ' + job.data.mail);
      setImmediate(done);
    });
  });
});

mongoose.connect('mongodb://' + process.env.mongo + '/oneinvites', { autoIndex: process.env.NODE_ENV !== 'production' });

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
