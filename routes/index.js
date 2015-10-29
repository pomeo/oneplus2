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
const moment   = require('moment');
const multer   = require('multer');
const upload   = multer();
const winston  = require('winston');
const postmark = require('postmark');
const CLIENT   = new postmark.Client(process.env.POSTMARK);
const paypal   = require('paypal-rest-sdk');
const redirect = process.env.NODE_ENV === 'development' ?
        'http://10.38.38.200' : 'https://oneinvites.com';
const _url     = require('url');
const push     = require('pushover-notifications');

let p = new push({
  user: process.env.PUSHOVER_USER,
  token: process.env.PUSHOVER_TOKEN
});

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

paypal.configure({
  'mode': process.env.NODE_ENV === 'development' ? 'sandbox' : 'live',
  'client_id': process.env.PAYPALCLIENTID,
  'client_secret': process.env.PAYPALSECRET
});

const modelsPath = __dirname + '/../models';
fs.readdirSync(modelsPath).forEach(function(file) {
  if (~file.indexOf('js')) {
    require(modelsPath + '/' + file);
  }
});

let Emails = mongoose.model('EmailsForInvites');
let Acc = mongoose.model('EmailsAccounts');
let Mails = mongoose.model('Mails');
let Payments = mongoose.model('Payments');

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

router.get('/buy1', (req, res) => {
  Acc.count({
    type: 1,
    invite: false,
    sell: false
  }).exec((err, count) => {
    if (err) {
      log(err, 'error');
      res.sendStatus(500);
    } else {
      if (count === 0) {
        res.send('Accounts not available');
      } else {
        let create_payment_json = {
          'intent': 'sale',
          'payer': {
            'payment_method': 'paypal'
          },
          'redirect_urls': {
            'return_url': redirect + '/return',
            'cancel_url': redirect + '/cancel'
          },
          'transactions': [{
            'item_list': {
              'items': [{
                'name': 'Global invite with account',
                'sku': 'type1',
                'price': '2.00',
                'currency': 'USD',
                'quantity': 1
              }]
            },
            'amount': {
              'currency': 'USD',
              'total': '2.00'
            },
            'description': 'Global invite with account to buy OnePlus Two'
          }]
        };

        paypal.payment.create(create_payment_json, (error, payment) => {
          if (error) {
            log(error, 'error');
            res.sendStatus(500);
          } else {
            log('Create Payment Response');
            log(payment);
            payment.links.forEach((pay) => {
              if (pay.method === 'REDIRECT') {
                let p = new Payments({
                  paymentId: payment.id,
                  state: payment.state,
                  invite: false,
                  created_at: new Date(),
                  updated_at: new Date()
                });
                p.save(err => {
                  if (err) {
                    log(err, 'error');
                    res.sendStatus(500);
                  } else {
                    res.redirect(pay.href);
                  }
                });
              }
            });
          }
        });
      }
    }
  });
});

router.get('/return', (req, res) => {
  if (_.isEmpty(req.query.PayerID) ||
     _.isEmpty(req.query.paymentId) ||
     _.isUndefined(req.query.PayerID) ||
     _.isUndefined(req.query.paymentId)) {
    res.send('Error in query');
  } else {
    jobs.create('paypal', {
      paymentId: req.query.paymentId,
      PayerID: req.query.PayerID
    }).priority('normal').removeOnComplete(true).save();
    res.render('return');
  }
});

router.get('/cancel', (req, res) => {
  res.redirect('/');
});

router.get('/faq', (req, res) => {
  res.render('store');
});

router.get('/manual', (req, res) => {
  res.render('manual');
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
        acc.sell = true;
        acc.save(err => {
          if (err) {
            log(err, 'error');
            res.sendStatus(500);
          } else {
            let M = Mails.find({to: acc.email});
            M.sort({created_at: -1});
            M.limit(50);
            M.exec((err, emails) => {
              if (err) {
                log(err);
                res.send('Error');
              } else {
                if (acc.type === 0) {
                  res.render('mail', {
                    login: acc.email,
                    password: acc.password,
                    hash: acc.urlhash,
                    emails: emails
                  });
                } else {
                  res.render('mail', {
                    login: acc.email,
                    hash: acc.urlhash,
                    emails: emails
                  });
                }
              }
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

router.post('/webhook/callback', (req, res) => {
  log('WebhookPost: ' + JSON.stringify(req.body));
  res.sendStatus(200);
});

router.get('/webhook/callback', (req, res) => {
  log('WebhookGet: ' + JSON.stringify(req.query));
  res.sendStatus(200);
});

router.post('/check', (req, res) => {
  if (_.isNull(req.body.paymentId) || _.isEmpty(req.body.paymentId)) {
    res.send('Error');
  } else {
    Payments.findOne({
      paymentId: req.body.paymentId
    }, (err, payment) => {
      if (err) {
        log(err, 'error');
        res.sendStatus(200);
      } else {
        if (payment.state === 'approved') {
          if (payment.invite === true) {
            log(req.body.paymentId + ' already has invite');
            res.sendStatus(200);
          } else {
            Acc.count({
              type: 1,
              password: {
                $exists: false
              },
              sell: false,
              invite: false
            }).exec((err, count) => {
              let random = Math.floor(Math.random() * count);
              Acc.findOne({
                type: 1,
                password: {
                  $exists: false
                },
                sell: false,
                invite: false
              }).skip(random).exec((err, result) => {
                if (err) {
                  log(err, 'error');
                  res.sendStatus(200);
                } else {
                  if (_.isNull(result)) {
                    log('End accounts');
                    res.sendStatus(200);
                  } else {
                    CLIENT.sendEmailWithTemplate({
                      'From': 'robot@oneinvites.com',
                      'To': payment.email,
                      'TemplateId': 166061,
                      'TemplateModel': {
                        'action_url': redirect + '/mail/' + result.urlhash
                      }
                    });
                    let msg = {
                      title: 'OneInvites',
                      message: '+2$'
                    };
                    p.send(msg, function(err, result) {
                      if (err) {
                        log(err, 'error');
                      } else {
                        log(result);
                      }
                    });
                    payment.invite = true;
                    payment.save(err => {
                      if (err) {
                        log(err, 'error');
                        res.sendStatus(200);
                      } else {
                        res.json({
                          url: redirect + '/mail/' + result.urlhash
                        });
                      }
                    });
                  }
                }
              });
            });
          }
        } else {
          res.sendStatus(200);
        }
      }
    });
  }
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
