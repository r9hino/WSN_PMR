function timeNow() {

    var date = new Date();

    var hmsTime = date.toLocaleTimeString();
    
    var year = date.getFullYear();

    var month = date.getMonth() + 1;
    month = (month < 10 ? "0" : "") + month;

    var day  = date.getDate();
    day = (day < 10 ? "0" : "") + day;

    return day + "/" + month + "/" + year + " " + hmsTime;
}

function timeConverter(UNIX_timestamp){
    var a = new Date(UNIX_timestamp*1000);
    
    var hour = a.getHours() < 10 ? '0' + a.getHours() : a.getHours();
    var min = a.getMinutes() < 10 ? '0' + a.getMinutes() : a.getMinutes();
    var sec = a.getSeconds() < 10 ? '0' + a.getSeconds() : a.getSeconds();
    
    return hour + ':' + min + ':' + sec ;
}

module.exports.timeNow = timeNow;
module.exports.timeConverter = timeConverter;