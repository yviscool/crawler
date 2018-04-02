var fs = require('fs');
var os = require('os');
var open = require('opn');
var path = require('path');
var stream = require('stream');
var request = require('request');
var utils = require('./utils');
var config = require('../config');

var through2Concurrent = require('through2-concurrent');

module.exports = {
    downloadNovel(options) {
        new NovelPipe(options);
    },
    downloadMusicByAudioJungle(options) {
        new AudioJunglePipe(options);

    },
    downloadPic(options) {
        new WallHavenPipe(options);
    }
}


class CorePipe {
    constructor(opt) {
        this.RL = this.readline = opt.RL;
    }

    start() {
        this.getUrls()
            .pipe(this.parseContent())
            .pipe(this.download())
    }

    getUrls() {
        throw new Error('subclass must implement this method');
    }

    parseContent() {
        throw new Error('subclass must implement this method');
    }

    download() {
        throw new Error('subclass must implement this method');
    }

    get homeDir() {
        return os.platform() === 'win32'
            ? path.join(os.homedir(), "Desktop")
            : path.join(os.homedir());
    }

    load(page){
        return utils.load(page)
    }

    loadGB2312(page){
        return utils.loadGB2312(page);
    }
}

class NovelPipe extends CorePipe {

    constructor(options) {
        super(options)
        this.name = options.novelName;
        this.source = options.source;
        this.chapterUrls = options.chapterUrls;
        this.novelPath = path.join(this.homeDir, `${this.name}.md`);
        this.getChapterMsgFncArr = [
            this.getChapterMsgByPiaotian.bind(this),
            this.getChapterMsgByBiquge.bind(this)
        ];
        this.start();
    }

    // push小说的章节地址
    getUrls() {
        var tc = through2Concurrent.obj({ maxConcurrency: 5 });
        this.chapterUrls.forEach(ele => {
            tc.push(ele);
        })
        tc.push(null);
        this.RL.prompt();
        this.RL.write('等待写入完成，完成后会自动打开小说, ctrl+ u 清除该信息')
        return tc;
    }
    // 获取章节的名字 内容 
    parseContent() {
        var ctx = this;
        var source = this.source;
        var options = Object.create(config.options);
        return through2Concurrent.obj(
            { maxConcurrency: 5 },
            function (url, enc, next) {
                var self = this;
                options.url = url;
                options.encoding = null;
                request(options, (err, res, body) => {
                    var parserIterator = new ParserIterator(body, source);
                    if (err) return next();
                    if (!err && res.statusCode == 200) {
                        self.push(parserIterator.getParseContent(...ctx.getChapterMsgFncArr));
                    }
                    next();
                })
            })
    }

    // 下载小说
    download() {
        var RL = this.RL;
        var novelPath = this.novelPath;
        var name = this.name;
        var tc = through2Concurrent
            .obj({ maxConcurrency: 5 }, (chapter, enc, next) => {
                var content = utils.fsExistsSync(novelPath)
                    ? `###${chapter.name}\n${chapter.content}\n`
                    : `##${name}\n[toc]\n###${chapter.name}\n${chapter.content}\n`;
                fs.appendFileSync(novelPath, content);
                next();
            })
        tc.on('finish', () => {
            setTimeout(function () {
                open(novelPath, { wait: false })
                    .then(
                        () => { },
                        (e) => { RL.prompt(); RL.write(e.message); }
                    )
            }, 2000)
        });
        return tc;
    }

    getChapterMsgByBiquge(page, source) {
        if (source !== 'biquge') {
            return false;
        }

        var $ = this.load(page)

        return {
            'name': $('.bookname').children('h1').text(),
            'content': unescape($('#content').html()
                .replace(/\&nbsp;/g, '')
                .replace(/<br\s*\/?>/gi, "\r\n")
                .replace(/<script.*?>.*?<\/script>/ig, '')
                .replace(/<div.*?>.*?<\/div>/ig, '')
                .replace(/&#x/g, '%u')
                .replace(/;/g, '')
                .replace(/%uA0/g, '')
            )
        };
    }

    getChapterMsgByPiaotian(page, source) {
        if (source !== 'piaotian') {
            return false;
        }

        var $ = this.loadGB2312(page);

        var body = $('html').html()
        body.match(/<h1>[\s\S]*?<\/a>(.*)<\/h1>/g);
        var name = RegExp.$1;
        body.match(/<br>([\s\S]*)<!--/g)
        var content = RegExp.$1;
        return {
            'name': name,
            'content': unescape(content)
                .replace(/\&nbsp;/g, '')
                .replace(/<br\s*\/?>/gi, "\r\n")
                .replace(/<!--[\s\S]*/, '')
                .replace(/&#x/g, '%u')
                .replace(/;/g, '')
                .replace(/%uA0/g, '')

        };
    }

}



class AudioJunglePipe extends CorePipe {

    constructor(options) {
        super(options);
        this.musicDir = path.join(this.homeDir, 'music');
        this.options = options.options;
        this.start();
    }

    //push url的
    getUrls() {
        var tc = through2Concurrent.obj({ maxConcurrency: 5 });
        tc.push(this.options);
        tc.push(null);
        this.RL.prompt();
        this.RL.write('正在异步写入，你可以做点别的，ctrl+u 清除该信息');
        return tc;
    }

    // 获取mp3地址 
    parseContent() {
        var ctx = this;
        return through2Concurrent
            .obj({ maxConcurrency: 5 }, function (options, enc, next) {
                var self = this;
                request(options, function (err, res, body) {
                    if (err) return next();
                    if (!err && res.statusCode == 200) {
                        ctx.parseMusUrl(body).map(function (per) {
                            self.push(per);
                        });
                        next();
                    }
                })
            })
    }

    // 下载mp3
    download() {
        var musicDir = this.musicDir;
        var i = 0;
        var tc = through2Concurrent
            .obj({ maxConcurrency: 5 }, (musicUrl, enc, next) => {
                if (!utils.fsExistsSync(musicDir)) fs.mkdirSync(musicDir);
                request
                    .get(musicUrl)
                    .on('error', (err) => { console.log(err) })
                    .pipe(fs.createWriteStream(path.join(musicDir, i++ + ".mp3")));
                next();
            })

        tc.on('finish', () => { });

        return tc;
    }

    //获取 audiojungle mp3地址的
    parseMusUrl(page) {
        var $ = this.load(page);
        var urls = [];
        $('.product-list source').slice(0, 10).each(function () {
            urls.push($(this).attr('src'))
        })
        return urls;
    }

}

class WallHavenPipe extends CorePipe {

    constructor(options) {
        super(options);
        this.picDir = path.join(this.homeDir, 'pic');
        this.wallhavenPicUrl = options.options.url;
        this.wallhavenPic = 'https://wallpapers.wallhaven.cc/wallpapers/full/wallhaven-';
        this.start();
    }


    // push 图片网站的随机地址
    getUrls() {
        var tc = through2Concurrent.obj({ maxConcurrency: 5 })
        tc.push(this.wallhavenPicUrl);
        tc.push(null);
        this.RL.prompt();
        this.RL.write('正在异步写入,你可以做点别的了，ctrl+u 清除该信息');
        return tc;
    }

    // 获取该页面的所有图片地址 
    parseContent() {
        var ctx = this;
        var wallhavenPic = this.wallhavenPic;
        var tc = through2Concurrent
            .obj({ maxConcurrency: 5 }, function (options, enc, next) {
                var self = this;
                request(options, (err, res, body) => {
                    if (!err && res.statusCode == 200) {
                        ctx.getPicUrl(body).forEach(function (per) {
                            self.push(wallhavenPic + per + ".jpg");
                        });
                        next();
                    }
                })
            })
        return tc;
    }

    // 下载 图片 
    download() {
        var RL = this.RL;

        var picDir = this.picDir;
        var tc = through2Concurrent
            .obj({ maxConcurrency: 5 }, (imgUrl, enc, next) => {
                if (!utils.fsExistsSync(picDir)) {
                    fs.mkdirSync(picDir);
                }
                request
                    .get(imgUrl)
                    .on('error', function (err) {
                        console.log(err);
                    })
                    .pipe(fs.createWriteStream(path.join(picDir, path.basename(imgUrl))));
                next();
            })

        tc.on('finish', () => {});

        return tc;
    }

    getPicUrl(page) {
        var urls = [];
        var $ = this.load(page);
        $('.thumb-listing-page').find('.preview').each(function () {
            urls.push($(this).attr('href').substr(37));
        });
        return urls;
    }

}

class ParserIterator {
    constructor(...args) {
        this.args = args;
    }
    getParseContent(...args) {
        for (var i = 0, fn; fn = args[i++];) {
            var parseContent = fn.apply(fn, this.args)
            if (parseContent !== false) {
                return parseContent;
            }
        }
    }
}