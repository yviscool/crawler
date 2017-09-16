var fs = require('fs')
var os = require('os')
var open = require('opn');
var path = require('path')
var stream = require('stream');
var request = require('request');
var commonutils = require('./commonutils')
var config = require('../config');
var RL = require('./readline').Readline;

module.exports = {
    downloadNovel,
    downloadMusicByAudioJungle,
    downloadPic
}

function downloadNovel(chapterUrls, name, source) {
    NovelPipe.getNovelUrls(chapterUrls)
        .pipe(NovelPipe.requestChapter(source))
        .pipe(NovelPipe.download(name));
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

var NovelPipe = {
    // readable push小说的章节地址
    getNovelUrls(list) {
        const rs = stream.Readable({
            objectMode: true
        });
        list.forEach(function (ele) {
            rs.push(ele);
        });
        rs.push(null);
        return rs;
    },
    // transform 获取章节的名字 内容 
    requestChapter(source) {

        const trans = stream.Transform({
            readableObjectMode: true,
            writableObjectMode: true
        });
        var options = Object.create(config.options)
        trans._transform = function (url, enc, next) {
            options.url = url;
            options.encoding = null;
            request(options, (err, res, body) => {
                var iteratorParser = new IteratorParser(body, source)
                if (err) return next()
                if (!err && res.statusCode == 200) {
                    trans.push(iteratorParser.getParseContent(getChapterMsgByBiquge, getChapterMsgByPiaotian))
                }
                next();
            })
        }
        return trans;
    },
    // writable 下载小说
    download(name) {

        var ws = stream.Writable({
            objectMode: true
        })
        var novelPath =
            os.platform() === 'win32' ?
                path.join(os.homedir(), "Desktop", `${name}.md`) :
                path.join(os.homedir(), `${name}.md`);
        ws._write = function (chapter, enc, next) {
            var content = commonutils.fsExistsSync(novelPath) ?
                `###${chapter.name}\n${chapter.content}\n` :
                `##${name}\n[toc]\n###${chapter.name}\n${chapter.content}\n`;
            fs.appendFileSync(novelPath, content);
            next();
        }
        ws.on('finish', () => {
            setTimeout(function(){
                open(novelPath,{wait: false})
                    .then(
                    () => { RL.write(null, { ctrl: true, name: 'u' }); },
                    (e) => {RL.prompt(); RL.write(e.message); }
                    )
            },2000)
            RL.write(null, { ctrl: true, name: 'u' }); 
        });
        return ws;
    }
}

//获取小说内容
function getChapterMsgByBiquge(page, source) {
    if (source !== 'biquge') {
        return false;
    }
    var $ = commonutils.load(page)
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
    var $ = commonutils.loadGB2312(page);
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



var AudioJunglePipe = {
    //readable, push url的
    getAudiojungleUrls(options) {
        const rs = stream.Readable({
            objectMode: true
        });
        rs.push(options);
        rs.push(null);
        return rs;
    },
    // transform  获取mp3地址 
    getMusUrl() {
        const trans = stream.Transform({
            readableObjectMode: true,
            writableObjectMode: true
        });
        trans._transform = function (options, enc, next) {
            request(options, function (err, res, body) {
                if (err) return next();
                if (!err && res.statusCode == 200) {
                    parseMusUrl(body).map(function (per) {
                        trans.push(per);
                    });
                    next();
                }
            })
        }
        return trans;
    },

    // writable 下载mp3
    downloadMus() {
        var ws = stream.Writable({
            objectMode: true
        })
        var musicDir = os.platform() === 'win32' ?
            path.join(os.homedir(), 'Desktop', 'music') :
            path.join(os.homedir(), 'music');
        var i = 0;
        ws._write = function (musicUrl, enc, next) {
            if (!commonutils.fsExistsSync(musicDir)) fs.mkdirSync(musicDir);
            request
                .get(musicUrl)
                .on('error', function (err) {
                    console.log(err)
                })
                .pipe(fs.createWriteStream(path.join(musicDir, i++ + ".mp3")));
            next();

        }
        ws.on('finish', () => {
            RL.resume();
            RL.prompt()
            RL.write('正在异步写入，你可以做点别的，ctrl+u 清除该信息')
        });
        return ws;
    }
}


//获取 audiojungle mp3地址的
function parseMusUrl(page) {
    var $ = commonutils.load(page);
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

        var picDir = os.platform() === 'win32' ?
            path.join(os.homedir(), 'Desktop', 'pic') :
            path.join(os.homedir(), 'pic');

        ws._write = function (imgUrl, enc, next) {
            if (!commonutils.fsExistsSync(picDir)) {
                fs.mkdirSync(picDir);
                console.log('\n创建文件夹成功n')
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
    var $ = commonutils.load(page)
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