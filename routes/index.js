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
const fs       = require('fs');
const bcrypt   = require('bcrypt');
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

const modelsPath = __dirname + '/../models';
fs.readdirSync(modelsPath).forEach(function(file) {
  if (~file.indexOf('js')) {
    require(modelsPath + '/' + file);
  }
});

let Emails = mongoose.model('EmailsForInvites');
let Acc = mongoose.model('EmailsAccounts');
let Mails = mongoose.model('Mails');

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
    if (req.session.one === process.env.ADMIN) {
      res.redirect('/admin');
    } else {
      res.render('dashboard');
    }
  } else {
    res.redirect('/');
  }
});

router.get('/admin', (req, res) => {
  if (req.session.one) {
    if (req.session.one === process.env.ADMIN) {
      res.render('admin');
    } else {
      res.redirect('/');
    }
  } else {
    res.redirect('/');
  }
});

let generatePass = () => {
  var set = '0123456789abcdefghijklmnopqurstuvwxyzABCDEFGHIJKLMNOPQURSTUVWXYZ';
  var salt = '';
  for (var i = 0; i < 10; i++) {
    var p = Math.floor(Math.random() * set.length);
    salt += set[p];
  }
  return salt;
};

router.get('/admin/reg', (req, res) => {
  if (req.session.one) {
    if (req.session.one === process.env.ADMIN) {
      Emails.count().exec((err, count) => {
        let random = Math.floor(Math.random() * count);
        Emails.findOne().skip(random).exec((err, result) => {
          let login = result.mail.split('@')[0] + '123@humst.ru';
          res.render('admin/reg', {
            username: result.mail.split('@')[0] + '123',
            login: login,
            password: generatePass()
          });
        });
      });
    } else {
      res.redirect('/');
    }
  } else {
    res.redirect('/');
  }
});

router.post('/admin/reg', (req, res) => {
  if (req.session.one) {
    if (req.session.one === process.env.ADMIN) {
      bcrypt.genSalt(10, function(err, salt) {
        bcrypt.hash(req.body.login, salt, function(err, hash) {
          let acc = new Acc({
            email      : req.body.login,
            hash       : hash,
            password   : req.body.pass,
            invite     : false,
            sell       : false,
            created_at : new Date(),
            updated_at : new Date()
          });
          acc.save((err) => {
            if (err) {
              log(err);
              res.sendStatus(200);
            } else {
              log('Save ' + req.body.login);
              res.sendStatus(200);
            }
          });
        });
      });
    }
  }
});

router.get('/mail', (req, res) => {
  res.redirect('/');
});

router.get('/mail/:hash', (req, res) => {
  log(req.params.hash);
  Acc.findOne({
    hash: req.params.hash
  }, (err, acc) => {
    if (err) {
      log(err);
      res.redirect('/');
    } else {
      if (_.isNull(acc)) {
        res.send('Error');
      } else {
        let M = Mails.find({to: acc.email});
        M.sort({created_at: -1});
        M.limit(50);
        M.exec((err, emails) => {
          if (err) {
            log(err);
            res.send('Error');
          } else {
            res.render('mail', {
              login: acc.email,
              password: acc.password,
              hash: acc.hash,
              emails: emails
            });
          }
        });
      }
    }
  });
});

router.get('/mail/:hash/inbox/:email', (req, res) => {
  Acc.findOne({
    hash: req.params.hash
  }, function(err, acc) {
    if (err) {
      log(err);
      res.redirect('/');
    } else {
      res.render('mail', {
        login: acc.email,
        password: acc.password
      });
    }
  });
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
