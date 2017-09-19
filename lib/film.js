var fs = require('fs')
var url = require('url')
var path = require('path');
var config = require('../config');
var utils = require('../utils')
var request = utils.requestPromise;
var RL = utils.Readline;
var CustomError = require('./error');

var log = console.log.bind(console)

module.exports.getLatest = function () {

    var painyuan = new Painyuan(config.options);


    painyuan.getLatestFilm()
        .then(() => { return RL.questionPromise(Prompt.filmInfo) })
        .then(verifyInput)
        .then(select)
        .then(getDownLoadLinkORSearch)
        .then(begin)
        .catch(begin)

    function verifyInput(msg) {
        if (/^\d/.test(msg) && msg != painyuan.filmMap.size) {
            msg = parseInt(msg);
        } else if (/\\/.test(msg)) {
            msg = msg.replace(/\\/, "//");
        } else if (/./.test(msg) && msg != painyuan.filmMap.size) {
            msg = msg;
        } else {
            throw new CustomError.BackError();
        }
        return msg;
    }

    function select(msg) {
        if (!/\D/.test(msg)) {
            return painyuan.getFilmMsg(msg);
        } else if (!path.extname(msg)) {
            return painyuan.searchFilm(msg);
        } else {
            return painyuan.downLoadSub(path.basename(msg, path.extname(msg)), path.dirname(msg));
        }
    }

   function getDownLoadLinkORSearch(msg) {
        return typeof msg === 'object' ?
            painyuan.getDownLoadLink(msg)
            :
            RL.questionPromise(Prompt.filmInfo)
                .then(verifyInput)
                .then(select)
                .then(getDownLoadLinkORSearch)
    }

    function begin(e) {
        e && e.message && RL.write(e.message);
        RL.prompt();
    }


}


var Prompt = {
    filmInfo: `\n按序号查看电影简介及相关信息和下载地址,亦可输入关键词搜索电影\n\n或直接拉进电影文件下载相关字幕(回车返回) --> `,
}

class Film {
    constructor(options) {
        this.options = Object.create(options);
        this.filmMap = new Map();
    }
    getLatestFilm() { throw new Error('sub must implement') }
    getFilmMsg() { throw new Error('sub must implement') }
    searchFilm() { throw new Error('sub must implement') }
}

class Painyuan extends Film {
    constructor(options) {
        super(options);
        this.options.url = config["id97"];
    }
    getLatestFilm() {
        var self = this;
        return request(this.options)
            .then(__parse);

        function __parse({ body, res }) {
            var $ = utils.load(body);
            $('.col-xs-12').eq(0).find('.meta').slice(0, 10).each(function (i, n) {
                var name = $(this).find('a').text();
                var url = $(this).find('a').attr('href');
                var score = $(this).find('em').text();
                self.filmMap.set(i, { name, url, score });
            })
            self.filmMap.forEach(function (film, i) {
                log(`\n${i}、${film.name} 豆瓣评分: ${film.score}`)
            })
        }
    }

    getFilmMsg(key) {
        var film = this.filmMap.get(key);
        this.options.url = film.url;
        return request(this.options)
            .then(__parse.bind(this))


        function __parse({ body, res }) {
            var $ = utils.load(body);
            var name = $('.year').parent().text() || film.name;
            var staffing = '';
            $('tbody').find('tr').slice(0, 3).each(function () {
                staffing += $(this).text();
            })
            var bio = $('.row').eq(2).text().replace(/#.+#.+/, "");
            return {
                name: name,
                bio: bio,
                url: film.url,
                staffing: staffing,
                downloadLink: [],
            }
        }
    }

    searchFilm(kw) {
        var self = this;
        this.filmMap.clear();
        this.options.url = "http://www.id97.com/search?q=" + encodeURI(kw);
        return request(this.options)
            .then(__parse.bind(this))

        function __parse({ body, res }) {
            var $ = utils.load(body);
            self.filmMap.clear();
            $('.movie-name').slice(0, 9).each(function (i, n) {
                var url = $(this).children('strong').children('a').attr('href');
                var name = $(this).children('strong').children('a').text();
                var score = $(this).next('.intro').find('strong').text();
                self.filmMap.set(i, { url, name, score });
                log(`\n${i}、${name} 豆瓣评分: ${score}`)
            })
        }
    }

    getDownLoadLink(film) {
        this.options.url = "http://www.id97.com/videos/resList" + film.url.slice(film.url.lastIndexOf('/'), film.url.lastIndexOf('.'));
        this.options.gzip = true;
        return request(this.options)
            .then(__parse.bind(this))

        function __parse({ body, res }) {
            delete this.options.gzip;
            var $ = utils.load(body)
            if ($('table').eq(0).html()) {
                var pan = $('table').eq(0).html().match(/((https?|ftp)+:\/\/)+(www\.)?[-a-zA-Z0-9@:%._\+~#=]{2,256}\.[a-z]{2,6}\b([-a-zA-Z0-9@:%_\+.~#?&//=]*)/g) || '';
                var pass = $('table').eq(0).html().match(/>.{4}</) ? $('table').eq(0).html().match(/>.{4}</)[0].slice(1, 5) : "";
                var magnetOrEd2k = $('table').eq(0).html().match(/magnet:.+"/) || $('table').eq(0).html().match(/ed2k:.+"/) || "";
                //存在网盘地址不存在会匹配视频格式的问题
                pan && pass && film.downloadLink.push("网盘地址: " + pan + " 密码: " + pass)
                magnetOrEd2k && film.downloadLink.push("下载地址: " + magnetOrEd2k[0].slice(0, magnetOrEd2k[0].length - 1));
            }
            log(`\n${film.name}`)
            log(film.staffing)
            log(film.bio)
            film.downloadLink.forEach(v => log(v))
        }
    }

    downLoadSub(msg, filmPath) {
        var self = this;
        this.options.url = `${config["zimuku"]}search?ad=1&q=${encodeURI(msg)}`;
        return request(this.options)
            .then(__parseUrl)
            .then(() => {
                return request(self.options)
                    .then(__getUrl)
            })
            .then((downloadLink) => {
                self.options.url = downloadLink;
                self.options.encoding = null;
                return request(self.options)
                    .then(({ body, res }) => {
                        var filename = res.headers["content-disposition"].match(/".*"/)[0].replace(/"/g, "");
                        fs.writeFile(path.join(filmPath, filename), body, function (err) {
                            if (err) return reject(err);
                            RL.write('下载成功')
                        });
                    });
            })

        function __parseUrl({ body, res }) {
            var $ = utils.load(body);
            if (!$(".sublist")) throw new Error('找不到字幕')
            config.options.url = url.resolve(config["zimuku"], $('.sublist').find('a').eq(0).attr('href'));
        }

        function __getUrl({ body, res }) {
            var $ = utils.load(body);
            var downloadLink = url.resolve(config["zimuku"], $('.dl').parent().attr('href'));
            return downloadLink;
        }

    }
}

