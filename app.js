var express = require('express'),
    app = express(),
    server = require('http').createServer(app),
    io = require("socket.io").listen(server),
    os = require('os'),
    mysql = require('mysql'),
    crypto = require('crypto'),
    nicknames = {};


//var ipAdress = os.networkInterfaces()['Ethernet'][1]['address'];
var ipAdress;
var ifaces = os.networkInterfaces();
Object.keys(ifaces).forEach(function (ifname) {
    var alias = 0;

    ifaces[ifname].forEach(function (iface) {
        if ('IPv4' !== iface.family || iface.internal !== false) {
            // skip over internal (i.e. 127.0.0.1) and non-ipv4 addresses
            return;
        }

        if (alias >= 1) {
            // this single interface has multiple ipv4 addresses
            console.log(ifname + ':' + alias, iface.address);
        } else {
            // this interface has only one ipv4 adress
            ipAdress = iface.address;
        }
        ++alias;
    });
});

console.log("current IP adress: " + ipAdress);

var connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'web_chat'
});

//connection.connect();

function userExist(login, callback) {
    connection.query('SELECT name FROM users', function (err, rows, fields) {
        if (err)
            throw new Error(err);
        for (var i = 0; i < rows.length; i++) {
            if (rows[i].name == login) {
                callback(true);
                return;
            }
        }
        callback(false);
    });
}

function loginUser(login, pass, callback) {
    connection.query("SELECT id FROM users WHERE name = ? AND password = ? LIMIT 1", [login, pass], function (err, rows, fields) {
        if (err) throw err;
        if (rows.length == 0) {
            callback("");
            return;
        }
        callback(rows[0]);
    });
}

function registerUser(login, password, callback) {
    connection.query("INSERT INTO users(name, password) VALUES('" + login + "', '" + password + "')", function (err, rows, fields) {
        if (err) throw err;
        if (rows)
            callback(true);
        else
            callback(false);
    });
}

server.listen( /*process.env.PORT*/ 8000, process.env.IP);
app.get('/', function (req, res) {
    res.sendfile(__dirname + '/index.html');
});

io.sockets.on('connection', function (socket) {
    socket.on('send message', function (data) {
        io.sockets.emit('new message', {
            msg: data,
            nick: socket.nickname
        });
    });

    socket.on('new user', function (data, callback) {
        var password = crypto.createHash('md5').update(data.pass).digest('hex');
        loginUser(data.login, password, function (respData) {
            if (respData.id == "" || respData == "") {
                callback(2);
            } else {
                callback(3);
                socket.nickname = data.login;
                nicknames[socket.nickname] = 1;
                updateNickNames();
            }
        });
    });

    socket.on('reg user', function (data, callback) {
        userExist(data.login, function (isExist) {
            if (isExist)
                callback(1);
            else {
                var password = crypto.createHash('md5').update(data.pass).digest('hex');
                registerUser(data.login, password, function (respData) {
                    if (respData)
                        callback(2);
                    else
                        callback(3);
                });
            }
        });
    });

    socket.on('disconnect', function (data) {
        if (!socket.nickname) return;
        delete nicknames[socket.nickname];
        updateNickNames();
    });

    function updateNickNames() {
        io.sockets.emit('usernames', nicknames);
    }
});