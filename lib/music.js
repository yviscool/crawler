var fs = require('fs');
var os = require('os');
var open = require('opn');
var path = require('path');
var request = require('request');
var musicAPI = require('music-api');
var config = require('../config');
var utils = require('./utils');
var downloadMusicByAudioJungle = require('./pipe').downloadMusicByAudioJungle;

var log = console.log.bind(log);


module.exports.getMusic = function () {
    var RL = this.RL;
    var PROMPTS = this.PROMPTS;
    var music = new Music(this.RL);

    return RL.question(PROMPTS.searchMusicOrgetAudio)
        .then(requestByAdOrSearch)

    function requestByAdOrSearch(input) {
        return input === ''
            ? requestMusicByAudiojungle()
            : music.search(input)
                .then(formatData.bind(music))
                .then(() => RL.question(PROMPTS.downloadMusicOrChangeEngine))
                .then(searchAgainOrdownloadMusic)
    }

    function searchAgainOrdownloadMusic(key) {
        var PrevInputKey = RL.inputKeys[RL.inputKeys.length - 2];
        RL.inputKeys.pop();
        if (/^\d$/.test(key)) {
            key = parseInt(key);
        } else if (key === '10') {
            throw new Error('');
        } else {
            return music.search(PrevInputKey)
                .then(formatData.bind(music))
                .then(() => RL.question(PROMPTS.downloadMusicOrChangeEngine))
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

    function requestMusicByAudiojungle() {

        const audiojungleMsg = config["audiojungle"];
    
        audiojungleMsg.category.forEach((type, i) => { log(i + " " + type) });
    
        return RL.question(PROMPTS.getMusic)
            .then(key => {
                if (/^\d{1,2}$/.test(key) && parseInt(key) <= audiojungleMsg.category.length - 1) {
                    key = parseInt(key);
                    config.options.url = audiojungleMsg["url"] + audiojungleMsg.category[key];
                    downloadMusicByAudioJungle({
                        options: config.options,
                        RL,
                    })
                } else {
                    throw new Error('');
                }
            })
    
    }
    
}


class Music {

    constructor(rl) {
        //'all','qq','xiami','netease'
        this.sources = ['qq', 'xiami', 'netease'];
        this.source = '';
        this.musicMap = new Map();

        this.RL = rl;
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

        var RL = this.RL;
        var musicPath = os.platform() === 'win32'
            ? path.join(os.homedir(), 'Desktop', name + '.mp3')
            : path.join(os.homedir(), name + '.mp3');

        RL.prompt()
        RL.write('正在异步写入，完成之后会自动播放音乐, ctrl + u 清除该信息')

        request
            .get(mp3Url)
            .on('error', function (err) {
                this.RL.prompt();
                this.RL.write(err.message)
            })
            .on('end', function () {
                setTimeout(function () {
                    open(musicPath, { wait: false })
                        .then(
                            () => { },
                            (e) => { RL.prompt(); RL.write(e.message); }
                        )
                }, 1000)
            })
            .pipe(fs.createWriteStream(musicPath));
    }
}


