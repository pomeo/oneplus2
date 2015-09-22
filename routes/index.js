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
    Acc.count({
      type: 0,
      invite: true,
      sell: false
    }).exec((err, count0) => {
      Acc.count({
        type: 1,
        invite: false,
        sell: false
      }).exec((err, count1) => {
        res.render('index', {
          type0: count0,
          type1: count1
        });
      });
    });
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
      Acc.count({
        password: {
          $exists: false
        },
        sell: false,
        invite: false
      }).exec((err, count) => {
        let random = Math.floor(Math.random() * count);
        Acc.findOne({
          password: {
            $exists: false
          },
          sell: false,
          invite: false
        }).skip(random).exec((err, result) => {
          let login = result.email;
          res.render('admin/reg', {
            username: result.email.split('@')[0] + '456',
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
      Acc.findOne({
        email: req.body.login
      }, function(err, a) {
        a.password = req.body.pass;
        a.updated_at = new Date();
        a.save((err) => {
          if (err) {
            log(err);
            res.sendStatus(200);
          } else {
            log('Save ' + req.body.login);
            res.sendStatus(200);
          }
        });
      });
    }
  }
});

router.get('/logout', (req, res) => {
  if (req.session) {
    req.session.destroy(() => {
      res.redirect('/');
    });
  } else {
    res.redirect('/');
  }
});

router.get('/mail', (req, res) => {
  res.redirect('/');
});

router.get('/mail/:hash', (req, res) => {
  log(req.params.hash);
  Acc.findOne({
    urlhash: req.params.hash
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
              hash: acc.urlhash,
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
    urlhash: req.params.hash
  }, function(err, acc) {
    if (err) {
      log(err);
      res.redirect('/');
    } else {
      Mails.findById(req.params.email, (err, mail) => {
        if (err) {
          log(err);
          res.sendStatus(500);
        } else {
          res.render('inbox', {
            login: acc.email,
            password: acc.password,
            from: mail.from,
            to: mail.to,
            subject: mail.subject,
            date: mail.date,
            html: mail.html
          });
        }
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
