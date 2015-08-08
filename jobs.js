/* jshint node:true */
/* jshint laxbreak:true */
/* jshint esnext:true */
var mongoose    = require('mongoose'),
    Schema      = mongoose.Schema,
    crypto      = require('crypto'),
    kue         = require('kue'),
    jobs        = kue.createQueue({
      prefix: 'q',
      disableSearch: true,
      jobEvents: false,
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
    //Browser     = require('zombie'),
    rollbar     = require('rollbar'),
    request     = require('request'),
    cheerio     = require('cheerio'),
    vm          = require('vm'),
    heapdump    = require('heapdump'),
    path        = require('path'),
    winston     = require('winston'),
    Logentries  = require('winston-logentries');

String.prototype.cleanup = function() {
   return this.toLowerCase().replace(/[^a-zA-Z0-9]+/g, '');
};

function randomIntFromInterval(min,max) {
  return Math.floor(Math.random()*(max-min+1)+min);
}

rollbar.init(process.env.rollbar);

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

jobs.promote(1500, 1);

jobs.watchStuckJobs();

setInterval(function() {
  kue.Job.rangeByState('complete', 0, 100, 'asc', function(err, jobs) {
    jobs.forEach(function(job) {
      job.remove(function(){
        log('removed ', job.id );
      });
    });
  });
}, 1000 );

var agenda = new Agenda({
  db: {
    address: process.env.mongo + '/oneinvites'
  }
});

setInterval(function() {
  EmailsInvites.find()
  .where('ref').ne(null)
  .$where('this.equal > this.count')
  .limit(1)
  .sort('order')
  .exec(function(err, email) {
    if (_.isNull(email)) {
      log('Пустая выдача');
    } else {
      if (err) {
        log('Ошибка: ' + err, 'error');
      } else {
        log(email[0].mail + ' ' + email[0].equal + ' ' + email[0].count);
        jobs.create('emailRegister', {
          ref: email[0].ref
        }).priority('normal').removeOnComplete(true).save();
      }
    }
  });
}, 3000 );

jobs.process('check', function(job, done) {
  var domain = require('domain').create();
  domain.on('error', function(err) {
    setImmediate(done);
  });
  domain.run(function() {
    log('Заходим в check ' + job.data.count);
    Mails.find({ subject: "Confirm your email" })
    .skip(job.data.count)
    .limit(1)
    .exec(function(err, email) {
      if (_.isNull(email)) {
        log('Пустая выдача');
        setImmediate(done);
      } else {
        if (err) {
          log('Ошибка: ' + err, 'error');
          setImmediate(done);
        } else {
          log(job.data.count + ' ' + email[0].to);
          job.data.count += 1;
          var $ = cheerio.load(email[0].html);
          jobs.create('clickConfirm', {
            to: email[0].to,
            url: $('a').first().attr('href')
          }).delay(2000).priority('normal').removeOnComplete(true).save();
          jobs.create('check', {
            count: job.data.count
          }).priority('normal').removeOnComplete(true).save();
          setImmediate(done);
        }
      }
    });
  });
});

jobs.process('emailRegister', function(job, done) {
  var domain = require('domain').create();
  domain.on('error', function(err) {
    setImmediate(done);
  });
  domain.run(function() {
    EmailsInvites.findOne({
      used: false
    }, null, {
      sort: {
        order: 1
      }
    }, function(err, m) {
         if (_.isNull(m)) {
           log('Пустая выдача');
           setImmediate(done);
         } else {
           if (err) {
             log('Ошибка: ' + err, 'error');
             setImmediate(done);
           } else {
             log(m.mail + ' ' + m.order);
             jobs.create('register', {
               id: m._id,
               to: m.mail,
               ref: job.data.ref
             }).delay(2000).priority('normal').removeOnComplete(true).save();
             setImmediate(done);
           }
         }
       });
  });
});

jobs.process('register', function(job, done) {
  var domain = require('domain').create();
  domain.on('error', function(err) {
    setImmediate(done);
  });
  domain.run(function() {
    var re = require('restler');
    re.get('https://invites.oneplus.net/index.php', {
      query: {
        'r': 'share/signup',
        'success_jsonpCallback': 'success_jsonpCallback',
        'email': job.data.to,
        'koid': job.data.ref
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/43.0.2357.132 Safari/537.36',
        'Referer': 'https://oneplus.net/invites?kolid=' + job.data.ref
      },
      timeout: 2000
    }).once('timeout', function(ms){
      log('Ошибка: Таймаут ' + ms + ' ms', 'error');
      re.removeAllListeners();
      setImmediate(done);
    }).once('error',function(err, response) {
      log('Ошибка: ' + err, 'error');
      re.removeAllListeners();
      setImmediate(done);
    }).once('abort',function() {
      log('Ошибка: Abort', 'error');
      re.removeAllListeners();
      setImmediate(done);
    }).once('fail',function(data, response) {
      log('Ошибка: ' + JSON.stringify(data), 'error');
      re.removeAllListeners();
      setImmediate(done);
    }).once('success',function(data, response) {
      log(data);
      var jsonpSandbox = vm.createContext({success_jsonpCallback: function(r){return r;}});
      var one = vm.runInContext(data,jsonpSandbox);
      var upsertData = {};
      if (one.ret == 0 || one.ret == 1 || one.errMsg == "We just sent you an e-mail with a confirmation link.") {
        upsertData.used = true;
      }
      EmailsInvites.findOneAndUpdate({
        _id: job.data.id
      }, upsertData, {
        upsert: false
      }, function(err, m) {
           if (_.isNull(m)) {
             log('Пустая выдача');
             setImmediate(done);
           } else {
             if (err) {
               log('Ошибка: ' + err, 'error');
               setImmediate(done);
             } else {
               if (one.ret == 0) {
                 if (!_.isUndefined(job.data.ref)) {
                   log('Реферальный код: ' + job.data.ref);
                   jobs.create('count', {
                     ref: job.data.ref
                   }).priority('normal').removeOnComplete(true).save();
                   setImmediate(done);
                 } else {
                   setImmediate(done);
                 }
               } else {
                 setImmediate(done);
               }
             }
           }
         });
    });
  });
});

jobs.process('count', function(job, done) {
  var domain = require('domain').create();
  domain.on('error', function(err) {
    setImmediate(done);
  });
  domain.run(function() {
    var upsertData = {
      $inc: {
        count : 1
      }
    };
    EmailsInvites.findOneAndUpdate({
      ref: job.data.ref
    }, upsertData, {
      upsert: false
    }, function(err, m) {
         if (_.isNull(m)) {
           log('Пустая выдача');
           setImmediate(done);
         } else {
           if (err) {
             log('Ошибка: ' + err, 'error');
             setImmediate(done);
           } else {
             log('+1 ' + m.mail);
             setImmediate(done);
           }
         }
       });
  });
});

jobs.process('clickConfirm', function(job, done) {
  var domain = require('domain').create();
  domain.on('error', function(err) {
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
      }).delay(2000).priority('low').removeOnComplete(true).save();
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
      var ref = response.socket._httpMessage.path.split('/invites?kid=')[1];
      log('Реферальный код при сохранении: ' + ref + ' почта: ' + job.data.to);
      var upsertData = {
        ref        : ref,
        confirm    : true,
        updated_at : new Date()
      };
      EmailsInvites.findOneAndUpdate({
        mail: job.data.to
      }, upsertData, {
        upsert: false
      }, function(err, m) {
           if (_.isNull(m)) {
             log('Пустая выдача');
             setImmediate(done);
           } else {
             if (err) {
               log('Ошибка: ' + err, 'error');
               setImmediate(done);
             } else {
               log('Подтверждена почта ' + m.mail);
               setImmediate(done);
             }
           }
         });
    });
  });
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

function readFile100() {
  fs.readFile('./wiki-100k.txt', 'utf8', function(err, data) {
    if (err) throw err;
    var array = data.toString().split('\n');
    var i = 1;
    async.each(array, function(line, callback) {
      var num;
      if (i <= 100) {
        num = randomIntFromInterval(50,100);
      } else {
        num = randomIntFromInterval(1,5);
      }
      var email = line.cleanup() + '@humst.ru';
      jobs.create('createEmails', {
        email: email,
        hash: crypto.createHash('sha512')
              .update(email + process.env.SECRET)
              .digest('hex'),
        i: i,
        n: num
      }).priority('normal').removeOnComplete(true).save();
      i += 1;
      setImmediate(callback);
    }, function(err) {
         if (err) {
           log('Ошибка в async: ' + err);
         } else {
           log('Всё закончено');
         }
       });
  });
}

jobs.process('createEmails', function(job, done) {
  var domain = require('domain').create();
  domain.on('error', function(err) {
    setImmediate(done);
  });
  domain.run(function() {
    var M = new EmailsInvites({
      order      : job.data.i,
      mail       : job.data.email,
      hash       : job.data.hash,
      equal      : job.data.n,
      count      : 0,
      confirm    : false,
      used       : false,
      created_at : new Date(),
      updated_at : new Date()
    });
    M.save(function(err) {
      if (err) {
        log('Ошибка сохранения в mongo ' + err);
        setImmediate(done);
      } else {
        log('Почта ' + job.data.email);
        setImmediate(done);
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
