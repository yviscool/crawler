var fs = require('fs')
var Iconv = require('iconv-lite');
var request = require('request');
var cheerio = require('cheerio')

module.exports = {
    load(body) {
        return cheerio.load(body);
    },
    encode(str, charset) {
        if (isUTF8(charset)) {
            return encodeURIComponent(str);
        }

        var ch = '';
        var encodeStr = '';
        var buf = Iconv.encode(str, charset);
        for (var i = 0; i < buf.length; i++) {
            ch = buf[i].toString('16');
            if (ch.length === 1) {
                ch = '0' + ch;
            }
            encodeStr += '%' + ch;
        }
        encodeStr = encodeStr.toUpperCase();
        return encodeStr;
        function isUTF8(charset) {
            if (!charset) {
                return true;
            }
            charset = charset.toLowerCase();
            return charset === 'utf8' || charset === 'utf-8';
        }
    },
    fsExistsSync(path) {
        try {
            fs.accessSync(path, fs.F_OK);
        } catch (e) {
            return false;
        }
        return true;
    },
    loadGB2312(body) {
        return cheerio.load(Iconv.decode(body, 'gb2312'), { decodeEntities: false });
    },
    request(options) {
        return new Promise((resolve, reject) => {
            request(options, function (err, res, body) {
                if (err) return reject(err);
                if (!err && res.statusCode == 200) {
                    resolve({ body, res })
                }
                if (res.statusCode == 302 || res.statusCode == 301) {
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
    },
};



