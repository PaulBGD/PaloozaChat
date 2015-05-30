(function () {
    var url = 'http://127.0.0.1:3000/v1/';
    var name;
    var id;
    var apiKey;
    var server;
    var lastMessage = 1;

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
        if (app.hasChildNodes()) {
            app.insertBefore(span, app.childNodes[0]);
        } else {
            app.appendChild(span);
        }
        return span;
    }

    function logError(message) {
        logNormal(message).classList.add('m-error');
    }

    function getMessages() {
        ajax(url + 'servers/chat/latest', 'POST', {
            server: server,
            count: 100,
            startAt: lastMessage
        }, function (err, response) {
            if (err) {
                if (err.message == 429) {
                    return;
                }
                logError('Internal error occured');
                throw err;
            }
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
                    message: message.message
                });
            }
            if (ids.length) {
                ajax(url + 'player/from-ids', 'POST', {
                    ids: ids.join(',')
                }, function (err, response) {
                    if (err) {
                        if (err.message == 429) {
                            return;
                        }
                        logError('Internal error occured');
                        throw err;
                    }
                    response = JSON.parse(response);
                    if (response.error) {
                        return logError(response.message);
                    }
                    var length = messages.length;
                    for (var i = 0; i < length; i++) {
                        var message = messages[i];
                        logNormal(response[message.id].name + ': ' + message.message);
                    }
                });
            }
        });
    }

    var messages = {
        'Password is not set': 'You have not set your password yet. Go ingame and type /account password <password> to do so'
    };

    document.getElementById('send').addEventListener('submit', function (e) {
        var message = document.getElementById('message').value;
        document.getElementById('message').value = '';
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
                ajax(url + 'servers/chat/latest', 'POST', {
                    server: server,
                    count: 1
                }, function (err, response) {
                    if (err) {
                        if (err.message == 429) {
                            return;
                        }
                        logError('Internal error occured');
                        throw err;
                    }
                    response = JSON.parse(response);
                    if (response.error) {
                        return logError(response.message);
                    }
                    if (Object.keys(response).length > 0) {
                        for (var property in response) {
                            var message = response[property];
                            lastMessage = message.uid + 1;
                        }
                    }
                    callback();
                });
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