var os = require('os');
var fs = require('fs');
var url = require('url');
var path = require('path');
var utils = require('./utils');
var config = require('../config');

var request = utils.request;

var log = console.log.bind(console);


module.exports.getAnime = function () {

    var RL = this.RL;
    var PROMPTS = this.PROMPTS;

    var fengche = new FengChe(config.options);

    return RL.question(PROMPTS.todayInfoORSearch)
        .then(input => {

            input = input === ''
                ? ''
                : /\S/.test(input)
                ? input
                : function () { throw new Error('') }();

            return !input
                ? fengche.getTodayInfo(input)
                : fengche.searchByName(input);

        })
        .then(() => { return RL.question(PROMPTS.generateFile) })
        .then(input => {

            input =
                (/^\d$/.test(input) && parseInt(input) < fengche.animeMap.size)
                    ? parseInt(input, 10)
                    : function () { throw new Error('') }();

            return input;

        })
        .then(fengche.download.bind(fengche))

}

class FengChe {

    constructor(options) {
        this.options = Object.assign(options);
        this.options.url = config["mdm530"];
        this.options.encoding = null;
        this.options.timeout = 5 * 1000;
        this.animeMap = new Map();
    }

    getTodayInfo() {
        var self = this;
        this.animeMap.clear();
        return request(this.options)
            .then(__parse);
        function __parse({ body, res }) {
            var $ = utils.loadGB2312(body);
            var todayIndex = new Date().getDay() - 1;
            $('.am-tab-panel').eq(todayIndex).find('li').each(function (i, n) {
                var anime = {};
                anime.name = $(this).children('a').text();
                anime.update = $(this).children('span').text();
                anime.url = url.resolve("http://m.dm530.net/", $(this).children('a').attr('href'));
                self.animeMap.set(i, anime);
                log(`\n${i} ${anime.name} ${anime.update}`)
            })
        }
    }

    searchByName(kw) {
        var self = this;
        this.animeMap.clear();
        this.options.url = config["mdm530Search"] + "?searchword=" + utils.encode(kw, 'gbk');

        return request(this.options)
            .then(__parse)

        function __parse({ body, res }) {
            var $ = utils.loadGB2312(body);
            var dm530Url = "http://m.dm530.net/"
            $('.am-gallery').children('li').slice(0, 10).each(function (i, n) {
                var anime = {};
                anime.name = $(this).find('.am-gallery-title').text().trim();
                anime.update = $(this).find('.am-gallery-desc').text().trim();
                anime.url = url.resolve(dm530Url, $(this).find('a').attr('href'));
                self.animeMap.set(i, anime);
                log(`\n${i} ${anime.name} ${anime.update}`)
            })
        }
    }

    download(key){
        this.getAnimeMsg(key)
                .then(this.generateFile)
        throw new Error('等待写入完成, ctrl+ u 清除该信息');
    }

    getAnimeMsg(key) {
        var animeMsg = this.animeMap.get(key);
        this.options.url = animeMsg.url;
        return request(this.options)
            .then(__parse.bind(this))

        function __parse({ res, body }) {
            var $ = utils.loadGB2312(body);
            var anime = {
                name: animeMsg.name,
                movieUrl: [],
                downUrl: []
            };
            //番剧下载地址
            if ($('.am-tabs-nav li:last-child').text() !== '下载') {
                anime.downUrl.push('暂无下载地址');
            } else {
                $('.am-tab-panel').eq(-1).find('li').each(function () {
                    var name = $(this).children('a').text().trim();
                    var downUrl = $(this).children('a').attr('href');
                    anime["downUrl"].push(name + " : " + downUrl);
                })
            }
            // //番剧播放地址
            // if (!$('.am-tab-panel').eq(0)) {
            //     anime.movieUrl.push('暂无播放地址');
            // } else {
            //     $('.am-tab-panel').eq(0).find('li').each(function () {
            //         var name = $(this).children('a').text().trim();
            //         var movieUrl = url.resolve("http://www.dm530.net/", $(this).children('a').attr("href"));
            //         anime["movieUrl"].push(name + " : " + movieUrl);
            //     })
            // }

            return anime;
        }
    }

    generateFile(anime) {
        //  文件名非法
        anime.name = anime.name.replace(/[\\s\\\\/:\\*\\?\\\"<>\\|]/, " ");

        var animeDir = os.platform() === 'win32'
            ? path.join(os.homedir(), 'Desktop', `${anime.name}`)
            : path.join(os.homedir(), `${anime.name}`);

        fs.mkdirSync(animeDir);

        var content = anime.downUrl.reduce(function (prev, curr) {
            prev += curr + '\r\n';
        }, '');

        fs.writeFileSync(path.join(animeDir, '下载.txt'), anime.downUrl);
    }
}


