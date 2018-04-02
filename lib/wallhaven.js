var config = require('../config');
var { downloadPic } = require('./pipe');


module.exports.getPic = function () {

    var PROMPTS = this.PROMPTS;
    var RL = this.RL;

    config.options.url = config["wallhaven"];

    return this.RL.question(PROMPTS.pic)
        .then((msg) => {
            downloadPic({
                RL: RL,
                options: config.options,
            })
        })

}

