var config = require('../config');
var RL = require('./readline');
var downloadPic = require('./pipe').downloadPic;

module.exports.getPic = function () {

    config.options.url = config["wallhaven"];
    var prompt = `\n回车后会自动随机下载图片到桌面(window下桌面pic,linux下是/用户目录/pic) --> `;
    RL.questionPromise(prompt)
        .then((msg) => {
            RL.pause();
            if (msg.trim() === '') {
                downloadPic(config.options, RL)
            }
        })

}

