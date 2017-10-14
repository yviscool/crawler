var fs = require('fs')
var cheerio = require('cheerio')
var Iconv = require('iconv-lite');
var request = require('request');

module.exports = {
    fsExistsSync,
    loadGB2312,
    load,
    encode,
    requestPromise
};

function requestPromise(options) {
    return new Promise((resolve, reject) => {
        request(options, function (err, res, body) {
            if (err) return reject(err);
            if (!err && res.statusCode == 200) {
                resolve({ body, res })
            }
            if (res.statusCode == 302) {
                options.url = res.headers.location;
                delete options.method;
                delete options.headers['content-type'];
                delete options.body;
                delete options.timeout;
                request(options, function (err, res, body) {
                    if (err) return reject(err);
                    if (!err && res.statusCode == 200) {
                        resolve({ body, res })
                    }
                })
            }
        })
    })
}

function fsExistsSync(path) {
    try {
        fs.accessSync(path, fs.F_OK);
    } catch (e) {
        return false;
    }
    return true;
}

function loadGB2312(body) {
    return cheerio.load(Iconv.decode(body, 'gb2312'), { decodeEntities: false });
}

function load(body) {
    return cheerio.load(body);
}

function isUTF8(charset) {
    if (!charset) {
        return true;
    }
    charset = charset.toLowerCase();
    return charset === 'utf8' || charset === 'utf-8';
}

function encode(str, charset) {
    if (isUTF8(charset)) {
        return encodeURIComponent(str);
    }

    var buf = Iconv.encode(str, charset);
    var encodeStr = '';
    var ch = '';
    for (var i = 0; i < buf.length; i++) {
        ch = buf[i].toString('16');
        if (ch.length === 1) {
            ch = '0' + ch;
        }
        encodeStr += '%' + ch;
    }
    encodeStr = encodeStr.toUpperCase();
    return encodeStr;
}


