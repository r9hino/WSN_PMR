// Routes definitions.
// Links:   
//      http://passportjs.org/guide/authenticate/
//      http://stackoverflow.com/questions/13335881/redirecting-to-previous-page-after-authentication-in-node-js-using-passport

var express = require('express');
var router = express.Router();

// Simple route middleware to ensure user is authenticated.
function ensureAuthenticated(req, res, next){
    if(req.isAuthenticated()){
        return next();
    }
    // Store path, so it can be used to redirect in login page.
    req.session.previousPath = req.path;
    // If not authenticated, redirect user to login page.
    res.redirect('/login');
}

module.exports = function(passport){
    router.get('/', ensureAuthenticated, function(req, res){
        res.render('index');
    });

    router.get('/admin', ensureAuthenticated, function(req, res){
        res.render('admin');
    });

    router.get('/sensordata', ensureAuthenticated, function(req, res){
        res.render('sensordata');
    });

    router.get('/login', function(req, res){
        // If user is already logged, then redirect him to /index page.
        if(req.user){
            res.redirect('/');
        }
        else{
            res.render('login', { user: req.user, message: req.flash('error') });
        }
    });

    router.post('/login', function(req, res){
        var previousPath = req.session.previousPath;
        delete req.session.previousPath;
        passport.authenticate('local', {
            successRedirect: previousPath || '/',    // Redirect to where we came from.
            failureRedirect: '/login',
            failureFlash: true
        })(req, res);
    });

    return router;
};