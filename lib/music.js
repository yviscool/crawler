var fs = require('fs');
var os = require('os')
var open = require('opn')
var path = require('path')
var musicAPI = require('music-api');
var request = require('request');
var config = require('../config');
var utils = require('../utils')
var RL = utils.Readline;
var log = console.log.bind(log);

module.exports.getMusic = function () {
    var music = new Music();
    RL.questionPromise(Prompt.searchMusicOrgetAudio)
        .then(requestByAdOrSearch)
        .catch(begin)

    function requestByAdOrSearch(input) {
        return input === '' ?
            requestMusicByAudiojungle() :
            music.search(input)
                .then(formatData.bind(music))
                .then(() => RL.questionPromise(Prompt.downloadMusicOrChangeEngine))
                .then(searchAgainOrdownloadMusic)
    }

    function searchAgainOrdownloadMusic(key) {
        var PrevInputKey = RL.inputKeys[RL.inputKeys.length - 2];
        RL.inputKeys.pop();
        if (/^\d$/.test(key)) {
            key = parseInt(key);
        } else {
            return music.search(PrevInputKey)
                .then(formatData.bind(music))
                .then(() => RL.questionPromise(Prompt.downloadMusicOrChangeEngine))
                .then(searchAgainOrdownloadMusic)
        }

        var { id, name, artist, source } = music.musicMap.get(key);
        return music.getRealUrl(source, id)
                .then((url) => {
                    music.download(name, url)
                })
    }

    function formatData(data) {
        var i = 0;
        this.musicMap.clear();
        var source = this.source !== 'all' ? this.source : null;

        if (data.success) {
            data.songList.forEach(function (song) {
                __parsesongList.call(this, song)
            }, this)

        } else {
            for (var source in data) {
                data[source].songList.forEach(function (song) {
                    __parsesongList.call(this, song)
                }, this)
            }
        }

        function __parsesongList(song) {
            var id = song.id.toString();
            var name = song.name;
            var artists = [];
            song.artists.forEach(function (artist) {
                artists.push(artist.name);
            })
            this.musicMap.set(i++, { id, name, artists, source })
            log(i - 1, name, artists.join(','), source)
        }

    }

    function begin(e) {
        e && e.message && RL.write(e.message);
        RL.prompt();
    }
}


class Music {

    constructor() {
        //'all','qq','xiami','netease'
        this.sources = ['qq', 'xiami', 'netease'];
        this.source = '';
        this.musicMap = new Map();
    }

    search(key = '周杰伦') {
        this.source = this.sources.shift();
        this.sources.push(this.source);
        return musicAPI.searchSong(this.source, { key: key, limit: 10, page: 1 })
    }

    // 虾米,网易云音乐没有版权会返回false，而qq音乐是可以下载的。WTF
    getRealUrl(source, id) {
        return musicAPI.getSong(source, { id: id })
    }

    download(name, mp3Url) {

        var musicPath = os.platform() === 'win32' ?
            path.join(os.homedir(), 'Desktop', name + '.mp3') :
            path.join(os.homedir(), name + '.mp3');

        request
            .get(mp3Url)
            .on('error', function (err) {
                RL.prompt();
                RL.write(err.message)
            })
            .on('end', function () {
                setTimeout(function () {
                    open(musicPath,{wait:false})
                        .then(
                        () => {RL.write(null, { ctrl: true, name: 'u' }); },
                        (e) => { RL.prompt(); RL.write(e.message); }
                        )
                }, 1000)
            })
            .pipe(fs.createWriteStream(musicPath));
    }
}

function requestMusicByAudiojungle() {

    const audiojungleMsg = config["audiojungle"];

    audiojungleMsg.category.forEach((type, i) => { log(i + "、" + type) });

    return RL.questionPromise(Prompt.getMusic)
        .then(key => {

            if (/^\d{1,2}$/.test(key)) {
                key = parseInt(key);
            } else {
                throw new Error('输入不合法，请重新输入, ctrl + u 清除该信息')
            }
            config.options.url = audiojungleMsg["url"] + audiojungleMsg.category[key];
            utils.downloadMusicByAudioJungle(config.options)
        })

}

const Prompt = {
    searchMusicOrgetAudio: `\n请输入想要搜索的音乐，或则直接回车获取audioungle相关音乐 ---> `,
    getMusic: '\n输入相应数字下载对应的音乐(win下默认是桌面/music,linux是用户目录/music) ---> ',
    downloadMusicOrChangeEngine: '\n输入对应数字下载音乐，或则回车更换搜索引擎再次搜索　---> ',
}
