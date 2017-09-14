var request = require('request');
var config = require('../config');
var utils = require('../utils')
var musicAPI = require('music-api');
var RL = utils.Readline;
var open = require('opn')

var log = console.log.bind(log);

var fs = require('fs');
module.exports.getMusic = function () {
    var music = new Music();
    RL.questionPromise(Prompt.searchMusicOrgetAudio)
        .then(input => {
            if (input === '') {
                return requestMusicByAudiojungle()
            } else {
                return music.search(input)
            }
            return music.search(input).then(formatData.bind(this))

            function formatData(data) {
                for (var source in res) {
                    var i = 0;
                    res[source].songList.forEach(function (song) {
                        var id = song.id;
                        var name = song.name;
                        var artists = [];
                        song.artists.forEach(function (artist) {
                            artists.push(artist.name);
                        })
                        thsi.musicMap.set(i++, { id, name, artists, source })
                        console.log(source, name, artists.join(','), i, id)
                    })
                }
            }
        })
        .catch(log)
}


class Music {
    constructor() {
        // ['netease', 'xiami', 'qq', 'all'];
        this.sources = 'all';
        this.musicMap = new Map();
    }
    search(key = '周杰伦') {
        return musicAPI.searchSong(this.sources, { key: key, limit: 10, page: 1 })
    }
    //004TvCRS1q6oTr  xiami 
    //000ME0ec1SoUoP qq
    //004TvCRS1q6oTr qq
    // 虾米,网易云音乐下载后会返回false，而qq音乐是可以下载的。。。
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
                log(err)
            })
            .on('end', function () {
                setTimeout(function () {
                    open(musicPath)
                        .then(() => {
                            throw new Error('')
                        })
                        .catch(() => {
                            RL.prompt()
                        })
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

            if (/^\d{1,2}$/.test( key )) {
                key = parseInt(key);
            } else{
                throw new Error('输入不合法，请重新输入, ctrl + u 清除该信息')
            }
            config.options.url = audiojungleMsg["url"] + audiojungleMsg.category[key];
            utils.downloadMusicByAudioJungle(config.options)
        })

}
var Prompt = {
    searchMusicOrgetAudio: `\n请输入想要搜索的音乐，或则直接回车获取audioungle相关音乐 ---> `,
    getMusic: '\n输入相应数字下载对应的音乐(win下默认是桌面/music,linux是用户目录/music) ---> '
}
