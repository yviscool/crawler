var readline = require('readline');
var prompt = `\n请选择你想要获取的信息?\n\n 1. 新电影 2. 音乐 3. 小说 4. 番剧 5. wallhaven \n\n > `

module.exports.Readline = new Readline(prompt);

function Readline(prompt = `提示`) {
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: prompt
    })
    rl.inputKeys = [];
    rl.questionPromise = rl.questionPromise || function(prompt){
        rl.resume();
        return new Promise((resolve) => {
            rl.question(prompt, (msg) => {
                rl.pause();
                msg = getChineseOrCDB(msg.trim())
                rl.inputKeys.push(msg);
                resolve(msg)
            })
        })
    }
    return rl;
}


function getChineseOrCDB(str) {
    var isChinese = /[\u4e00-\u9fa5]/g.test(str);
    //全角
    var isDBC = /[\uff00-\uffff]/g.test(str);
    //半角
    //var isCDB= /[\u0000-\u00ff]/g.test(str)
    return isChinese ? str : isDBC ? ToCDB(str) : str;
}

function ToCDB(str) {
    var tmp = "";
    for (var i = 0; i < str.length; i++) {
        if (str.charCodeAt(i) == 12288) {
            tmp += String.fromCharCode(str.charCodeAt(i) - 12256);
            continue;
        }
        if (str.charCodeAt(i) > 65280 && str.charCodeAt(i) < 65375) {
            tmp += String.fromCharCode(str.charCodeAt(i) - 65248);
        }
        else {
            tmp += String.fromCharCode(str.charCodeAt(i));
        }
    }
    return tmp
}