(function () {
    var url = 'http://dev.minigamepalooza.com/api/v1/';
    var name;
    var id;
    var apiKey;
    var server;
    var lastMessage = 1;
    var previous = [];
    var previousIndex = -1;

    var loading = false;

    function ajax(url, type, params, callback) {
        var xmlhttp;
        if (window.XMLHttpRequest) {
            // code for IE7+, Firefox, Chrome, Opera, Safari
            xmlhttp = new XMLHttpRequest();
        } else {
            // code for IE6, IE5
            xmlhttp = new ActiveXObject('Microsoft.XMLHTTP');
        }
        xmlhttp.onreadystatechange = function () {
            if (xmlhttp.readyState == XMLHttpRequest.DONE) {
                if (xmlhttp.status == 200) {
                    callback(null, xmlhttp.responseText);
                } else {
                    callback(new Error(xmlhttp.status));
                }
            }
        };
        xmlhttp.ontimeout = function () {
            callback(new Error('Timed out'));
        };

        var string = '';
        for (var property in params) {
            string += property + '=' + params[property] + '&';
        }
        if (string.length > 0) {
            string = string.substr(0, string.length - 1);
        }
        xmlhttp.open(type, url + '?' + string, true);
        xmlhttp.send();
    }

    function logNormal(message) {
        var span = document.createElement('span');
        span.innerHTML = message.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
        var app = document.getElementById('app');
        var bottom = window.scrollMaxY === window.scrollY;
        app.appendChild(span);
        if (bottom) {
            window.scrollTo(0, document.body.scrollHeight);
        }
        return span;
    }

    function logError(message) {
        logNormal(message).classList.add('m-error');
    }

    function getMessages() {
        async.waterfall([
            function (callback) {
                ajax(url + 'servers/chat/latest', 'POST', {
                    server: server,
                    count: 100,
                    startAt: lastMessage
                }, callback);
            },
            function (response, callback) {
                response = JSON.parse(response);
                if (response.error) {
                    return logError(response.message);
                }
                var messages = [];
                var ids = [];
                for (var property in response) {
                    var message = response[property];
                    lastMessage = message.uid + 1;
                    ids.push(message.id);
                    messages.push({
                        id: message.id,
                        message: message.message,
                        type: message.type
                    });
                }
                if (ids.length) {
                    ajax(url + 'player/from-ids', 'POST', {
                        ids: ids.join(',')
                    }, function (err, response) {
                        callback(err, response, messages);
                    });
                }
            },
            function (response, messages) {
                response = JSON.parse(response);
                if (response.error) {
                    return logError(response.message);
                }
                var length = messages.length;
                for (var i = 0; i < length; i++) {
                    var message = messages[i];
                    var prefix = '';
                    if (message.type == 1) {
                        prefix = '[BROADCAST] ';
                    } else if (message.type == 2) {
                        prefix = '[WEB] ';
                    }
                    logNormal(prefix + response[message.id].name + ': ' + message.message);
                }
            }
        ], function (err) {
            if (err) {
                if (err.message == 429) {
                    return;
                }
                logError('Internal error occured');
                throw err;
            }
        });
    }

    var messages = {
        'Password is not set': 'You have not set your password yet. Go ingame and type /account password <password> to do so'
    };

    document.getElementById('message').addEventListener('keydown', function (e) {
        if (e.keyCode == 38) {
            if (previousIndex + 1 < previous.length) {
                previousIndex++;
                this.value = previous[previousIndex];
            }
        } else if (e.keyCode == 40) {
            if (previousIndex > 0) {
                previousIndex--;
                this.value = previous[previousIndex];
            }
        } else {
            previousIndex = -1;
        }
    });

    document.getElementById('send').addEventListener('submit', function (e) {
        var message = document.getElementById('message').value;
        document.getElementById('message').value = '';
        previous.unshift(message);
        if (message.length > 0 && message.charAt(0) == '/') {
            // let's handle this command
            logNormal(message);
            var arguments = message.replace('/', '').split(' ');
            var command = arguments.shift();
            if (command.toLowerCase() == 'online') {
                ajax(url + 'servers/players', 'POST', {
                    server: server
                }, function (err, response) {
                    if (err) {
                        logError('An error occurred retrieving online players');
                        throw err;
                    }
                    response = JSON.parse(response);
                    var players = {};
                    var ids = [];
                    for (var property in response) {
                        var list = response[property];
                        var length = list.length;
                        while (length--) {
                            var id = list[length];
                            players[id] = property; // reverse
                            ids.push(id);
                        }
                    }
                    ajax(url + 'player/from-ids', 'POST', {
                        ids: ids.join(',')
                    }, function (err, response) {
                        if (err) {
                            logError('An error occurred retrieving players');
                            throw err;
                        }
                        response = JSON.parse(response);
                        var names = [];
                        for (var property in response) {
                            names.push(response[property].name);
                        }
                        logNormal('Online Players: ' + names.join(','));
                    });
                });
            } else {
                logError('Invalid command "' + command + '"! Valid commands: /online');
            }
        } else {
            ajax(url + 'servers/chat/send', 'POST', {
                id: id,
                server: server,
                api_key: apiKey,
                message: message
            }, function (err, response) {
                if (err) {
                    if (err.message == 429) {
                        return logError('Please slow down');
                    }
                    logError('Internal error occured');
                    throw err;
                }
                response = JSON.parse(response);
                if (response.error) {
                    return logError(response.message);
                }
            });
        }
        e.preventDefault();
        return false;
    });

    document.getElementById('login').addEventListener('submit', function (e) {
        if (loading) {
            return;
        }
        loading = true;
        var username = document.getElementById('username').value;
        var password = document.getElementById('password').value;
        var loginError = document.getElementById('loginError');
        loginError.style.display = 'none';
        async.waterfall([
            function (callback) {
                ajax(url + 'player/from-name', 'POST', {
                    name: username
                }, callback);
            },
            function (response, callback) {
                response = JSON.parse(response);
                if (response.error) {
                    return callback(response.error);
                }
                name = response[username].name;
                id = response[username].id;
                ajax(url + 'player/auth/authenticate', 'POST', {
                    id: id,
                    password: password
                }, callback);
            },
            function (response, callback) {
                response = JSON.parse(response);
                if (response.error) {
                    return callback(response.message);
                }
                apiKey = response[id];
                ajax(url + 'servers/servers', 'POST', {}, callback);
            },
            function (response, callback) {
                response = JSON.parse(response);
                if (response.error) {
                    return callback(response.message);
                }
                var length = response.length;
                var select = document.getElementById('serverSelect');
                while (length--) {
                    var server = response[length].server;
                    (function (server) {
                        var element = document.createElement('button');
                        element.innerHTML = server;
                        element.addEventListener('click', function (e) {
                            callback(null, server);
                        });
                        select.appendChild(element);
                    })(server);
                }
                document.getElementById('loginContainer').style.display = 'none';
                select.style.display = 'block';
            },
            function (selected, callback) {
                server = selected;
                callback();
            }
        ], function (err) {
            loading = false;
            if (err) {
                if (typeof err == 'string') {
                    if (messages[err]) {
                        err = messages[err];
                    }
                    loginError.innerHTML = err;
                    return loginError.style.display = 'block';
                }
                throw new Error(err);
            }
            document.getElementById('serverSelect').style.display = 'none';
            document.getElementById('app').style.display = 'block';
            setInterval(getMessages, 1500);
        });
        e.preventDefault();
        return false;
    });
})();