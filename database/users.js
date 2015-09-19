// Resources to handle user database.


var exports = module.exports = {};

// Users definition for system loggin.
var users = [
    { id: 0, username: 'guest', password: '1234'}
];

// Find user by ID.
exports.findById = function(id, fn){
    var idx = id;
    if(users[idx]){
        fn(null, users[idx]);
    } 
    else{
        fn(new Error('User ' + id + ' does not exist'));
    }
}

// Find a username in the database.
exports.findByUsername = function(username, fn){
    for (var i = 0, len = users.length; i < len; i++){
        var user = users[i];
        if(user.username === username){
            return fn(null, user);
        }
    }
    return fn(null, null);
}