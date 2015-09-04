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
// const Browser     = require('zombie');
const rollbar     = require('rollbar');
const cheerio     = require('cheerio');
const vm          = require('vm');
const path        = require('path');
const util        = require('util');
const winston     = require('winston');

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

var agenda = new Agenda({
  db: {
    address: process.env.mongo + '/oneinvites'
  }
});

jobs.process('mail', function(job, done) {
  var domain = require('domain').create();
  domain.on('error', function(err) {
    setImmediate(done);
  });
  domain.run(function() {
    var M = new Mails({
      from       : job.data.from,
      to         : job.data.to,
      subject    : job.data.subject,
      date       : job.data.date,
      html       : job.data.html,
      text       : job.data.text,
      created_at : new Date(),
      updated_at : new Date()
    });
    M.save(function(err, m) {
      if (err) {
        log('Письмо ' + job.data.to + ' Ошибка: ' + err, 'error');
        setImmediate(done);
      } else {
        log('Письмо ' + job.data.to + ' сохранено');
        if (job.data.subject == 'Confirm your email') {
          var $ = cheerio.load(job.data.html);
          log($('a').first().attr('href'));
          jobs.create('clickConfirm', {
            to: m.to,
            url: $('a').first().attr('href')
          }).delay(2000).priority('normal').removeOnComplete(true).save();
          setImmediate(done);
        } else {
          setImmediate(done);
        }
      }
    });
  });
});

mongoose.connect('mongodb://' + process.env.mongo + '/oneinvites', { autoIndex: process.env.NODE_ENV !== 'production' });

var Apps          = require('./models').Apps;
var Products      = require('./models').Prdt;
var Tasks         = require('./models').Task;
var Charges       = require('./models').Chrg;
var Mails         = require('./models').Mail;
var EmailsInvites = require('./models').Emfi;

//Логгер в одном месте, для упрощения перезда на любой логгер.
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
  log((process.memoryUsage().rss / 1024 / 1024).toFixed(2) + 'Mb');
}, 60000);