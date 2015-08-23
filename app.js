'use strict';
const express      = require('express');
const debug        = require('debug')('app');
const session      = require('express-session');
const RedisStore   = require('connect-redis')(session);
const path         = require('path');
const favicon      = require('serve-favicon');
const logger       = require('morgan');
const cookieParser = require('cookie-parser');
const bodyParser   = require('body-parser');
const rollbar      = require('rollbar');
const jsFiles      = require('./routes/assets.json');

let routes = require('./routes/index');

let app = express();

app.set('port', process.env.PORT || 3000);

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
if (app.get('env') !== 'development') {
  app.enable('view cache');
}
app.set('trust proxy', 1);
app.use(favicon(__dirname + '/public/favicon.ico'));
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
  extended: true
}));
app.use(cookieParser());
var sessionConfig = {
  store: new RedisStore({
    host:process.env.redis,
    port:6379,
    pass:''
  }),
  secret: process.env.SECRET,
  proxy: true,
  cookie: {
    httpOnly: true,
    secure: false,
    maxAge: null
  },
  resave: false,
  saveUninitialized: false
};

if (app.get('env') !== 'production') {
  sessionConfig.cookie.secure = false;
  sessionConfig.cookie.maxAge = 31536000000;
}

app.use(session(sessionConfig));
app.use(express.static(path.join(__dirname, 'public')));

app.locals.files = jsFiles;

app.use('/', routes);

/// catch 404 and forwarding to error handler
app.use(function(req, res, next) {
  let err = new Error('Not Found');
  err.status = 404;
  next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
      message: err.message,
      error: err
    });
  });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
  res.status(err.status || 500);
  res.render('error', {
    message: err.message,
    error: {}
  });
});

app.use(rollbar.errorHandler(process.env.rollbar));

var server = app.listen(app.get('port'), function() {
               debug('Express server listening on port ' +
                     server.address().port);
             });
