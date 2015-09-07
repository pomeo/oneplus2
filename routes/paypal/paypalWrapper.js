'use strict';
const paypal     = require('paypal-rest-sdk');
const fs         = require('fs');
const mongoose   = require('mongoose');
const _          = require('lodash');
const modelsPath = __dirname + '/../../models';
const winston    = require('winston');

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

fs.readdirSync(modelsPath).forEach(function(file) {
  if (~file.indexOf('js')) {
    require(modelsPath + '/' + file);
  }
});

const redirect = process.env.NODE_ENV === 'development' ?
        'http://10.38.38.200' : 'http://oneinvites.com';

paypal.configure({
  'mode': process.env.NODE_ENV === 'development' ? 'sandbox' : 'live',
  'client_id': process.env.PAYPALCLIENTID,
  'client_secret': process.env.PAYPALSECRET,
  'openid_redirect_uri': redirect + '/callback/paypal'
});

module.exports = {
  helpers: {
    getLoginUrl: () => {
      return paypal.openIdConnect.authorizeUrl({
        'scope': 'openid email'
      });
    }
  },
  handlers: {
    handleAuthCallback: (req, res) => {
      let authCode = req.query.code;
      let openIdConnect = paypal.openIdConnect;
      openIdConnect.tokeninfo.create(authCode, (e, tokeninfo) => {
        if (e) {
          log(e);
          res.status(500).send({
            error: e
          });
        } else {
          paypal.openIdConnect.userinfo.get(
            tokeninfo.access_token, (err, userinfo) => {
              if (err) {
                log(err);
                res.status(500).send({
                  error: err
                });
              } else {
                let Acc = mongoose.model('Accounts');
                var upsertData = {
                  userid : userinfo.user_id,
                  email  : userinfo.email
                };
                Acc.findOneAndUpdate({
                  userid: userinfo.user_id
                }, upsertData, {
                  upsert: true
                }, function(err) {
                  if (err) {
                    log('Error: ' + err);
                    res.status(500).send({
                      error: err
                    });
                  } else {
                    req.session.one = userinfo.email;
                    res.redirect('/');
                  }
                });
              }
            });
        }
      });
    }
  }
};

function log(logMsg, logType) {
  if (logMsg instanceof Error) logger.error(logMsg.stack);
  if (!_.isUndefined(logType)) {
    logger.log(logType, logMsg);
  } else {
    logger.info(logMsg);
  }
}
