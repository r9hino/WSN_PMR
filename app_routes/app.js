// Express app configuration

var express = require('express');
var compression = require('compression');
var minify = require('express-minify');
var passport = require('passport');
var LocalStrategy = require('passport-local').Strategy;
var logger = require('morgan');
var expressSession = require('express-session');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var methodOverride = require('method-override');
var favicon = require('serve-favicon');
var flash = require('connect-flash');  

var __rootProject = __dirname + '/..';


// Initialize Passport
//var initPassport = require('./initPassport'); initPassport(passport);
require('./initPassport')(passport);

var app = express();

app.set('views', __rootProject + '/views');
app.set('view engine', 'ejs');
app.use(compression());
//app.use(minify({cache: __dirname + '/public/cache'}));
app.use(favicon(__rootProject + '/public/images/favicon.ico'));
app.use(logger('dev'));
app.use(cookieParser());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(methodOverride());
app.use(expressSession({ secret: 'keyboard cat' , saveUninitialized: true,  resave: true }));
// Initialize Passport!  Also use passport.session() middleware, to support persistent login sessions (recommended).
app.use(flash());
app.use(passport.initialize());
app.use(passport.session());
app.use(express.static(__rootProject + '/public', {
    etag: true,
    maxage: 0
}));


// Express routes definition.
var routes = require('./routes')(passport);
app.use('/', routes);


app.use(errorHandler);

function errorHandler(err, req, res, next) {
  res.status(500);
  res.render('error', { error: err });
}

// Catch 404 and forwarding to error handler.
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

// Error handlers.
// Development error handler will print stacktrace.
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.status(err.status || 500);
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}
// Production error handler, no stacktraces leaked to user.
app.use(function(err, req, res, next) {
    res.status(err.status || 500);
    res.render('error', {
        message: err.message,
        error: {}
    });
});


module.exports = app;
