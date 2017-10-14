var RL = require('./lib/readline');

RL.prompt();

RL.on('line', (msg) => {
    msg === '1' || msg === '１' 
        ? require('./lib/film').getLatest(RL) 
        : msg === '2' || msg === '２' 
        ? require('./lib/music').getMusic(RL) 
        : msg === '3' || msg === '３' 
        ? require('./lib/novel').search(RL) 
        : msg === '4' || msg === '４' 
        ? require('./lib/anime').getAnime(RL) 
        : msg === '5' || msg === '５' 
        ? require('./lib/wallhaven').getPic(RL) 
        : function begin() { RL.prompt(); RL.write('输入不合法，请重新输入, ctrl + u 清除该信息') }();
})

RL.on('close', () => { process.exit(0); });

