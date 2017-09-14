var readline = require('readline');
var getChineseOrCDB = require('./commonutils').getChineseOrCDB;

var prompt = `\n请选择你想要获取的信息?\n\n 1. 新电影 2. 音乐 3. 小说 4. 番剧 5. wallhaven \n\n > `

module.exports.Readline = new Readline(prompt);


function Readline(prompt = `提示`) {
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: prompt
    })
    rl.currentKey = '';
    rl.questionPromise = rl.questionPromise || function(prompt){
        rl.resume();
        return new Promise((resolve) => {
            rl.question(prompt, (msg) => {
                rl.pause();
                rl.currentKey = getChineseOrCDB(msg.trim())
                resolve(rl.currentKey)
            })
        })
    }
    return rl;
}


