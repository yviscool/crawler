var config = require('../config');
var downloadPic = require('./pipe').downloadPic;


module.exports.getPic = function () {

    var PROMPTS = this.PROMPTS;

    config.options.url = config["wallhaven"];
    this.RL.question(PROMPTS.pic)
        .then((msg) => {
            if (msg.trim() === '') {
                downloadPic(config.options, this.RL)
            }
        })

}

