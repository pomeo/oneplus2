/* jshint node:true */
/* jshint laxbreak:true */
/* jshint esnext:true */
var mongoose    = require('mongoose'),
    Schema      = mongoose.Schema,
    kue         = require('kue'),
    jobs        = kue.createQueue({
      prefix: 'q',
      disableSearch: true,
      redis: {
        host: process.env.redis
      }
    }),
    rest        = require('restler'),
    xml2js      = require('xml2js'),
    fs          = require('fs'),
    moment      = require('moment'),
    Agenda      = require('agenda'),
    _           = require('lodash'),
    async       = require('async'),
    cc          = require('coupon-code'),
    Browser     = require('zombie'),
    winston     = require('winston'),
    Logentries  = require('winston-logentries');

if (process.env.NODE_ENV === 'development') {
  var logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)()
    ]
  });
} else {
  var logger = new (winston.Logger)({
    transports: [
      new winston.transports.Logentries({
        token: process.env.logentries
      })
    ]
  });
}

jobs.watchStuckJobs();



var agenda = new Agenda({
  db: {
    address: process.env.mongo + '/oneinvites'
  }
});

mongoose.connect('mongodb://' + process.env.mongo + '/oneinvites', { autoIndex: process.env.NODE_ENV !== 'production' });

var Apps        = require('./models').Apps;
var Products    = require('./models').Prdt;
var Tasks       = require('./models').Task;
var Collections = require('./models').Coll;
var Charges     = require('./models').Chrg;

//Логгер в одном месте, для упрощения перезда на любой логгер.
function log(logMsg, logType) {
  if (logMsg instanceof Error) logger.error(logMsg.stack);
  if (!_.isUndefined(logType)) {
    logger.log(logType, logMsg);
  } else {
    logger.info(logMsg);
  }
}
