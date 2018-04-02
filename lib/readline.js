var readline = require('readline');
var Select = require('./select');

class Readline extends readline.Interface {

    constructor(opt = {
        input: process.stdin,
        output: process.stdout,
        prompt: `\n请选择你想要获取的信息?\n\n1. 新电影 2. 音乐 3. 小说 4. 番剧 5. wallhaven \n\n-> `
    }) {
        super(opt);
        super.prompt();
        this.inputKeys = [];
    }

    question(prompt) {
        super.resume();
        return new Promise(resolve => {
            super.question(prompt, msg => {
                super.pause();
                msg = this.getChineseOrCDB(msg.trim());
                this.inputKeys.push(msg);
                resolve(msg);
            })
        })
    }

    start() {
        return new Promise(resolve => {
            super.on('line', line => {
                line = this.getChineseOrCDB(line.trim());
                this.select.load(line);
            })
            super.on('close', () => {
                super.close();
                resolve();
            })
        })
    }

    getChineseOrCDB(str) {
        var isChinese = /[\u4e00-\u9fa5]/g.test(str);
        //全角
        var isDBC = /[\uff00-\uffff]/g.test(str);
        //半角
        //var isCDB= /[\u0000-\u00ff]/g.test(str)
        return isChinese ? str : isDBC ? ToCDB(str) : str;
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
            return tmp;
        }
    }

    begin(e) {
        e && e.message && super.write(e.message);
        super.prompt();
    }

    get select() {
        return new Select(this);
    }
}

module.exports = Readline;

new Readline().start() 