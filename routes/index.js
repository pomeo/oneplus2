/* jshint node:true */
/* jshint laxbreak:true */
/* jshint esnext:true */
var mongoose   = require('mongoose'),
    Schema     = mongoose.Schema,
    express    = require('express'),
    crypto     = require('crypto'),
    kue        = require('kue'),
    router     = express.Router(),
    _          = require('lodash'),
    jobs       = kue.createQueue({
      prefix: 'q',
      disableSearch: true,
      redis: {
        host: process.env.redis
      }
    }),
    rest       = require('restler'),
    xml2js     = require('xml2js'),
    moment     = require('moment'),
    winston    = require('winston'),
    Logentries = require('winston-logentries');

if (process.env.NODE_ENV === 'development') {
  var logger = new (winston.Logger)({
    transports: [
      new (winston.transports.Console)()
    ]
  });
} else {
  var logger = new (winston.Logger)({
    transports: [
      new winston.transports.Logentries({token: process.env.logentries})
    ]
  });
}

router.get('/', function(req, res) {
  res.render('index', { title: 'Express' });
});

router.post('/webhook', function(req, res) {
  log(req.body);
  jobs.create('mail', {
    from: req.body.from[0].address,
    to: req.body.to[0].address,
    subject: req.body.subject,
    date: req.body.date,
    html: req.body.html,
    text: req.body.text
  }).priority('normal').removeOnComplete(true).save();
  res.sendStatus(200);
});

module.exports = router;

mongoose.connect('mongodb://' + process.env.mongo + '/oneinvites', { autoIndex: process.env.NODE_ENV !== 'production' });

var Mails     = require('../models').Mail;

//Логгер в одном месте, для упрощения перезда на любой логгер.
function log(logMsg, logType) {
  if (logMsg instanceof Error) logger.error(logMsg.stack);
  if (!_.isUndefined(logType)) {
    logger.log(logType, logMsg);
  } else {
    logger.info(logMsg);
  }
};
