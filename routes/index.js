'use strict';
const mongoose = require('mongoose');
const express  = require('express');
const io       = require('redis.io');
const router   = express.Router();
const _        = require('lodash');
const jobs     = io.createQueue({
  prefix: 'q',
  disableSearch: true,
  jobEvents: false,
  redis: {
    host: process.env.redis
  }
});
const multer   = require('multer');
const upload   = multer();
const winston  = require('winston');

let logger;

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

let pp = require('./paypal/paypalWrapper');

router.get('/', (req, res) => {
  if (req.session.one) {
    res.redirect('/dashboard');
  } else {
    res.render('index');
  }
});

router.get('/dashboard', (req, res) => {
  if (req.session.one) {
    res.render('dashboard');
  } else {
    res.redirect('/');
  }
});

router.get('/login', (req, res) => {
  res.render('login', {
    url: pp.helpers.getLoginUrl()
  });
});

router.get('/callback/paypal', pp.handlers.handleAuthCallback);

router.post('/webhook', upload.array(), (req, res, next) => {
  let msg = JSON.parse(req.body.mailinMsg);
  let regexp = /humst/g;
  let match = msg.to[0].address.match(regexp);
  if (_.isNull(match)) {
    res.sendStatus(200);
  } else {
    log(msg.from[0].address);
    jobs.create('mail', {
      from: msg.from[0].address,
      to: msg.to[0].address,
      subject: msg.subject,
      date: msg.date,
      html: msg.html,
      text: msg.text
    }).priority('normal').removeOnComplete(true).save();
    res.sendStatus(200);
  }
});

router.get('/create', (req, res) => {
  // jobs.create('check', {
  //   count: 1
  // }).delay(2000).priority('normal').removeOnComplete(true).save();
  res.sendStatus(200);
});

module.exports = router;

mongoose.connect('mongodb://' + process.env.mongo + '/oneinvites', {
  autoIndex: process.env.NODE_ENV !== 'production'
});

//Логгер в одном месте, для упрощения перезда на любой логгер.
function log(logMsg, logType) {
  if (logMsg instanceof Error) logger.error(logMsg.stack);
  if (!_.isUndefined(logType)) {
    logger.log(logType, logMsg);
  } else {
    logger.info(logMsg);
  }
};
