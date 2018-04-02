var fs = require('fs');
var path = require('path');

class Select {
    constructor(readline) {

        var loaders = [
            require('./anime'),
            require('./film'),
            require('./music'),
            require('./novel'),
            require('./wallhaven'),
        ]
        // mixin methods to select 
        for (var loader of loaders) {
            Object.assign(Object.getPrototypeOf(this), loader);
        }
        // readline instance
        this.RL = this.readline = readline;

        // 
        this.map = new Map;
        this.map.set('1', this.getLatest);
        this.map.set('2', this.getMusic);
        this.map.set('3', this.getNovel);
        this.map.set('4', this.getAnime);
        this.map.set('5', this.getPic);

        this.PROMPTS = {
            todayInfoORSearch: `\n按回车获取今日番剧信息，或则直接输入关键字进行搜索 --> `,
            generateFile: '\n输入序号生成该动漫播放文件和网盘地址(txt格式)或则回车返回上级 --> ',
            filmInfo: `\n按序号查看电影简介及相关信息和下载地址,亦可输入关键词搜索电影\n\n或直接拉进电影文件下载相关字幕(回车返回) --> `,
            searchMusicOrgetAudio: `\n请输入想要搜索的音乐，或则直接回车获取audioungle相关音乐 --> `,
            getMusic: '\n输入相应数字下载对应的音乐(win下默认是桌面/music,linux是用户目录/music) --> ',
            downloadMusicOrChangeEngine: '\n输入对应数字下载音乐，回车更换搜索引擎再次搜索,10返回 --> ',
            input: `\n请输入你想要搜索的小说名或则作者名 --> `,
            select: `\n回车查看第一个小说的最新章节，其它请输入对应序号 --> `,
            download: `\n回车下载最新章节,数字1-9下载数字个章节,0下载全本小说,10返回主菜单\n\n(md格式,win下默认下载到桌面,linux默认下载到/用户目录/下) --> `,
            pic: `\n回车后会自动随机下载图片到桌面(window下桌面pic,linux下是/用户目录/pic) --> `,
        }
    }


    load(msg = (function () {
        throw new Error('msg must be exist');
    })) {
        var RL = this.RL;
        // 数字对应的逻辑
        var fnc = this.map.get(msg);
        if (typeof fnc === 'function') {
            fnc
                .call(this)
                .then(RL.begin.bind(RL))
                .catch(RL.begin.bind(RL))
        } else {
            RL.begin();
        }
    }

}

module.exports = Select;