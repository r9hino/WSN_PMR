// Passport setting
var LocalStrategy = require('passport-local').Strategy;

var users = require('./../database/users');

module.exports = function(passport){
    passport.serializeUser(function(user, done){
        done(null, user.id);
    });
    
    passport.deserializeUser(function(id, done){
        users.findById(id, function(err, user){
            done(err, user);
        });
    });
    
    // Use the LocalStrategy within Passport.
    passport.use(new LocalStrategy(function(username, password, done){
        process.nextTick(function(){
            users.findByUsername(username, function(err, user){
                if(err) return done(err);
                if(!user) return done(null, false, {message: 'Wrong username or password'});
                if(user.password !== password) return done(null, false, {message: 'Wrong username or password'});
                return done(null, user);
            });
        });
    }));
};