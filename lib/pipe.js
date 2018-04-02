var fs = require('fs');
var os = require('os');
var open = require('opn');
var path = require('path');
var stream = require('stream');
var request = require('request');
var utils = require('./utils');
var config = require('../config');

var through2Concurrent = require('through2-concurrent');
var streamToPromise = require('stream-to-promise');

module.exports = {
    downloadNovel,
    downloadMusicByAudioJungle,
    downloadPic,
}

function downloadNovel(chapterUrls, name, source, RL) {
    new NovelPipe(chapterUrls, source, name, RL);
}

function downloadMusicByAudioJungle(options) {
    AudioJunglePipe.getAudiojungleUrls(options)
        .pipe(AudioJunglePipe.getMusUrl())
        .pipe(AudioJunglePipe.downloadMus());
}

function downloadPic(url) {
    WallHavenPipe.getWallhavenUrls(url)
        .pipe(WallHavenPipe.getWallhavenPics())
        .pipe(WallHavenPipe.downloadImg())
}


class NovelPipe {

    constructor(chapterUrls, source, name, rl) {
        this.name = name;
        this.source = source;
        this.chapterUrls = chapterUrls;
        this.RL = this.readline = rl;
        this.novelPath =
            os.platform() === 'win32'
                ? path.join(os.homedir(), "Desktop", `${name}.md`)
                : path.join(os.homedir(), `${name}.md`);
        this.start();
    }

    start() {
        this.getNovelUrls()
            .pipe(this.requestChapter())
            .pipe(this.download())
    }

    // push小说的章节地址
    getNovelUrls() {
        var tc = through2Concurrent.obj({ maxConcurrency: 5 }, (_, enc, next) => { })
        this.chapterUrls.forEach(ele => {
            tc.push(ele);
        })
        tc.push(null);
        this.RL.prompt();
        this.RL.write('等待写入完成，完成后会自动打开小说, ctrl+ u 清除该信息')
        return tc;
    }
    // 获取章节的名字 内容 
    requestChapter() {
        var source = this.source;
        var options = Object.create(config.options)
        return through2Concurrent.obj(
            { maxConcurrency: 5 },
            function (url, enc, next) {
                var self = this;
                options.url = url;
                options.encoding = null;
                request(options, (err, res, body) => {
                    var parserIterator = new IteratorParser(body, source);
                    if (err) return next();
                    if (!err && res.statusCode == 200) {
                        self.push(parserIterator.getParseContent(getChapterMsgByBiquge, getChapterMsgByPiaotian))
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
}

//获取小说内容
function getChapterMsgByBiquge(page, source) {

    if (source !== 'biquge') {
        return false;
    }

    var $ = utils.load(page)

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

function getChapterMsgByPiaotian(page, source) {
    if (source !== 'piaotian') {
        return false;
    }

    var $ = utils.loadGB2312(page);

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



class AudioJunglePipe {

    constructor() {
        this.RL = this.readline = rl;
        this.musicDir = os.platform() === 'win32'
            ? path.join(os.homedir(), 'Desktop', 'music')
            : path.join(os.homedir(), 'music');

    }

    //push url的
    getAudiojungleUrls(options) {
        var tc = through2Concurrent.obj({ maxConcurrency: 5 }, (_, enc, next) => { })
        tc.push(options)
        tc.push(null);
        this.RL.prompt()
        this.RL.write('正在异步写入，你可以做点别的，ctrl+u 清除该信息')
        return tc;
    }

    // transform  获取mp3地址 
    getMusUrl() {
        return through2Concurrent
            .obj({ maxConcurrency: 5 }, (options, enc, next) => {
                var self = this;
                request(options, function (err, res, body) {
                    if (err) return next();
                    if (!err && res.statusCode == 200) {
                        parseMusUrl(body).map(function (per) {
                            self.push(per);
                        });
                        next();
                    }
                })
            })
    }

    // writable 下载mp3
    downloadMus() {
        var musicDir = musicDir;
        var i = 0;
        var tc = through2Concurrent
            .obj({ maxConcurrency: 5 }, (musicUrl, enc, next) => {
                var self = this;
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
}


//获取 audiojungle mp3地址的
function parseMusUrl(page) {
    var $ = utils.load(page);
    var urls = []
    $('.product-list source').slice(0, 10).each(function () {
        urls.push($(this).attr('src'))
    })
    return urls;
}


var WallHavenPipe = {

    // readble push 图片网站的随机地址
    getWallhavenUrls(url) {
        var rs = stream.Readable({
            objectMode: true
        });
        rs.push(url);
        rs.push(null);
        return rs;
    },
    // transform 获取改页面的所有图片地址 
    getWallhavenPics() {
        const wallhavenPic = 'https://wallpapers.wallhaven.cc/wallpapers/full/wallhaven-';
        var trans = stream.Transform({
            readableObjectMode: true,
            writableObjectMode: true
        })
        trans._transform = function (options, enc, next) {
            request(options, function (err, res, body) {
                if (!err && res.statusCode == 200) {
                    getPicUrl(body).forEach(function (per) {
                        trans.push(wallhavenPic + per + ".jpg");
                    });
                    next();
                }
            })
        }
        return trans;
    },
    // writable 下载 图片 
    downloadImg() {
        var ws = stream.Writable({
            objectMode: true
        })

        var picDir = os.platform() === 'win32'
            ? path.join(os.homedir(), 'Desktop', 'pic')
            : path.join(os.homedir(), 'pic');

        ws._write = function (imgUrl, enc, next) {
            if (!utils.fsExistsSync(picDir)) {
                fs.mkdirSync(picDir);
            }

            request
                .get(imgUrl)
                .on('error', function (err) {
                    console.log(err)
                })
                .pipe(fs.createWriteStream(path.join(picDir, path.basename(imgUrl))));

            next();
        }

        ws.on('finish', () => {
            RL.prompt();
            RL.write('正在异步写入,你可以做点别的了，ctrl+u 清除该信息')
        });

        return ws;
    }

}


function getPicUrl(page) {
    var $ = utils.load(page)
    var urls = []
    $('.thumb-listing-page').find('.preview').each(function () {
        urls.push($(this).attr('href').substr(37));
    });
    return urls;
}


class IteratorParser {
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