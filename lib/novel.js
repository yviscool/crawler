var url = require('url')
var config = require('../config');
var utils = require('../utils')
var RL = utils.Readline;
var request = utils.requestPromise;
var CustomError = require('./error');
var log = console.log.bind(console);


module.exports.search = function () {

    var novelMap = {};
    var biquge = new Biquge(config.options);
    var piaotian = new PiaoTian(config.options);

    RL.questionPromise(Prompt.input)
        .then(piaotian.searchByName.bind(piaotian))
        .then(
            () => {
                return RL.questionPromise(Prompt.select)
                    .then(verifyInputAndAssignMap)
                    .then(getNovelLatestChapterBySource)
                    .then(() => RL.questionPromise(Prompt.download))
            },
            (e) => {
                //网站访问失败则切换数据源，再次解析
                return e.message === 'ETIMEDOUT' || e.message === 'ESOCKETTIMEDOUT' ? 
                    biquge.searchByName(RL.inputKeys.pop())
                        .then(() => { return RL.questionPromise(Prompt.select) })
                        .then(verifyInputAndAssignMap)
                        .then(getNovelLatestChapterBySource)
                        .then(() => RL.questionPromise(Prompt.download))
                    :
                //重定向　或　搜索不到结果 
                    verifyErrorOrThrowError(e)
                
            }
        )
        .then(verifyInput)
        .then(getChapterUrlBySource)
        .then(downloadNovel)
        .catch(begin)


    function verifyInputAndAssignMap(input) {
        novelMap = biquge.novelMap.source ? biquge.novelMap : piaotian.novelMap;
        input = input === '' ?
            0 : (/^\d$/.test(input) && input !== novelMap.size) ?
                parseInt(input) : function () { throw new CustomError.InputError() }();

        return input;
    }

    function getNovelLatestChapterBySource(key) {
        return novelMap.source === 'biquge' ?
            biquge.getNovelLatestChapter(key) :
            piaotian.getNovelLatestChapter(key);
    }

    function verifyInput(input) {
        input = input === '' ?
            'default' : /^\d$/.test(input) ?
                parseInt(input) : input === '10' ?
                    'back' : function () { throw new CustomError.InputError()}();
        return input;
    }

    function verifyErrorOrThrowError(e) {
        if (e.message.length < 10) { return RL.questionPromise(Prompt.download) };
        throw new Error(e.message)
    }

    function getChapterUrlBySource(key) {
        novelMap = biquge.novelMap.source === 'biquge' ?
            biquge.novelMap :
            piaotian.novelMap;
        return novelMap.source === 'biquge' ?
            biquge.getChapterUrl(key) :
            piaotian.getChapterUrl(key);
    }

    function downloadNovel([chapterUrl, novelName, source]) {
        Novel.download(chapterUrl, novelName, source)
    }

    function begin(e) {
        e && e.message && RL.write(e.message);
        RL.prompt();
    }

}


const Prompt = {
    input: `\n请输入你想要搜索的小说名或则作者名 ---> `,
    select: `\n回车查看第一个小说的最新章节，其它请输入对应序号.---> `,
    download: `\n回车下载最新章节,数字1-9下载数字个章节,0下载全本小说,10返回主菜单\n\n(md格式,win下默认下载到桌面,linux默认下载到/用户目录/下) ---> `
}

class Novel {
    constructor(options) {
        this.options = Object.create(options);
        this.novelMap = new Map();
    }

    searchByName() { }
    getNovelLatestChapter() { }
    getChapterUrl() { }
    static download(chapterUrls, novelName = '未命名', source) {
        utils.downloadNovel(chapterUrls, novelName, source)
    }
}



class Biquge extends Novel {
    constructor(options) {
        super(options);
        this.options.url = config["biquge"];
    }

    searchByName(kw) {
        var self = this;
        kw = kw || '圣墟';
        this.options.url = this.options.url.replace('null', encodeURI(kw));
        return request(this.options)
            .then(__parse)

        function __parse({ body, res }) {
            var $ = utils.load(body)
            $('.result-game-item-detail').each(function (i, n) {
                var name = $(this).children("h3").children('a').text().trim();
                var url = $(this).children("h3").children('a').attr('href');
                var desc = $(this).find('.result-game-item-desc').text();
                var author = $(this).find('.result-game-item-info-tag').eq(0).text().trim().replace(/\s/g, "");
                self.novelMap.set(i, { name, url, desc, author })
                log("\n" + i + "、" + name + " " + author)
            });
            self.novelMap.source = 'biquge';
        }
    }

    getNovelLatestChapter(key) {
        this.options.url = this.novelMap.get(key).url;
        return request(this.options)
            .then(__parse.bind(this))

        function __parse({ body, res }) {
            var $ = utils.load(body)
            $('dd').slice(0, 9).each(function () {
                log("\n" + $(this).children('a').text());
            })
        }
    }


    getChapterUrl(flag) {
        var self = this;
        //返回主菜单
        if (flag === 'back' ){
            throw new Error('返回主菜单， ctrl + u 清除该信息')
        }

        return request(this.options)
            .then(__parse.bind(this))

        function __parse({ body, res }) {
            var $ = utils.load(body)
            var chapterUrls = [];
            var novelName = $('#info h1').text().trim();
            //下载最新章节
            if (flag === 'default') {
                $('dd').slice(0, 9).each(function () {
                    chapterUrls.push(url.resolve(self.options, url, $(this).children('a').attr('href')));
                })
            }
            // 下载数组个章节
            if (/^[1-9]$/.test(flag)) {
                $('dd').slice(0, flag).each(function () {
                    chapterUrls.push(url.resolve(self.options.url, $(this).children('a').attr('href')));
                })
            }

            //下载全本小说
            if (flag === '0') {
                $('dd').slice(9).each(function () {
                    chapterUrls.push(url.resolve(self.options.url, $(this).children('a').attr('href')));
                })
            }

            return [chapterUrls, novelName, self.novelMap.source];
        }
    }
}

class PiaoTian extends Novel {

    constructor(options) {
        super(options);
        this.options.url = config["piaotian"];
        this.options.encoding = null;
    }

    searchByName(kw) {
        kw = kw || '圣墟';
        var self = this;
        this.options.method = 'POST';
        this.options.headers['content-type'] = 'application/x-www-form-urlencoded';
        this.options.body = `searchtype=articlename&searchkey=${utils.encode(kw, 'gbk')}&Submit=+%CB%D1+%CB%F7+`;
        this.options.timeout = 1000 * 1;

        return request(this.options)
            .then(__parse)

        function __parse({ body, res }) {
            delete self.options.method;
            delete self.options.headers['content-type'];
            delete self.options.body;
            delete self.options.timeout;
            var $ = utils.loadGB2312(body)
            var pattern = /"center">[\s\S]*?<tr[\s\S]*?odd">[\s\S]*?href="([\s\S]*?)">(.*?)<\/a>[\s\S]*?target[\s\S]*?>(.*?)<\/a>[\s\S]*?odd">(.*?)<\/td>/g;
            if ($('.txt').length > 3) {
                var novelArr = $('#content').html().match(pattern)
                if (novelArr) {
                    novelArr.slice(0, 10).forEach(function (novel, i) {
                        novel.match(pattern);
                        var url = RegExp.$1;
                        var name = RegExp.$2;
                        var chapter = RegExp.$3;
                        var author = RegExp.$4;
                        self.novelMap.source = 'piaotian';
                        self.novelMap.set(i, { name, url, chapter, author })
                        log("\n" + i + "、" + name + " " + author + " " + "(" + chapter + ")")
                    })
                } else {
                    throw new CustomError.NovelNotFindError();
                }

            } else {
                $('.grid').eq(0).find('a').slice(1).each(function (i, n) {
                    log("\n" + $(this).text());
                })
                self.novelMap.isRedirect = true;
                self.novelMap.source = 'piaotian';
                throw new Error('redirect')
            }
        }
    }

    getNovelLatestChapter(key) {
        this.options.url = this.novelMap.get(key).url;
        return request(this.options)
            .then(__parse.bind(this))

        function __parse({ body, res }) {
            var $ = utils.loadGB2312(body)
            $('.grid').eq(0).find('a').slice(1).each(function (i, n) {
                log("\n" + $(this).text());
            })
        }
    }


    getChapterUrl(flag) {

        //返回主菜单
        if (flag === 'back' ){
            throw new CustomError.BackError();
        }

        var self = this;
        var chapterUrl = this.options.url;
        chapterUrl = chapterUrl.replace(/bookinfo/, 'html');
        this.options.url = chapterUrl.replace(/\.html/, '') + '/';
        return request(this.options)
            .then(__parse.bind(this));

        function __parse({ body, res }) {
            var $ = utils.loadGB2312(body)
            var chapterUrls = [];
            var novelName = $('.title').text().trim();
            var pattern = /<li>[\s\S]*?href="(.*?)">([\s\S]*?)<\/a>[\s\S]*?<\/li>/g;
            var novelArrStr = $('.centent').html().match(pattern)
            //下载最新章节
            if (flag === 'default') {
                novelArrStr.slice(-10).forEach(function (chapterStr, i) {
                    chapterStr.match(pattern);
                    chapterUrls.push(url.resolve(self.options.url, RegExp.$1))
                })
            }
            // 下载数组个章节
            if (/^[1-9]$/.test(flag)) {
                novelArrStr.slice(-flag).forEach(function (chapterStr, i) {
                    chapterStr.match(pattern);
                    chapterUrls.push(url.resolve(self.options.url, RegExp.$1))
                })
            }

            //下载全本小说
            if (flag === '0') {
                novelArrStr.forEach(function (chapterStr, i) {
                    chapterStr.match(pattern);
                    chapterUrls.push(url.resolve(self.options.url, RegExp.$1))
                });
            }

            return [chapterUrls, novelName, self.novelMap.source];
        }
    }
}