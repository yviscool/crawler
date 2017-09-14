## 自娱自乐的一个小爬虫

主要是利用`node`自带的`readline`模块，完成一个交互式的命令行爬虫工具。

### 主要功能

* 搜索小说，爬取小说的最新章节，全部章节，保存为`md`格式的文件到(`win`下是桌面，`linux`下是用户目录下)。自动打开该文件。
* 搜索最新电影，获取电影相关信息和下载地址, 可拖动视频文件下载相关字幕。
* 获取今日番剧和搜索番剧，获得该番剧的云盘地址或则下载(功能不全)。
* 搜索音乐，下载音乐。爬取audiojungle网站,根据对应的音乐类别下载。(win下是桌面/music，`linux`下是用户目录/music)。
* 爬取`wallpavn`(图片网站)，下载随机图片到(win下是桌面/pic，`linux`下是用户目录/pic)。
* 若干残疾今日信息(停更)。。。。

### 项目启动

1. npm install 
2. node index

### 注意

1. 小说，图片，音乐基本都是 readable.push(url)---> transform.push(request请求内容)----> writeable里面最终写入。

   虽然实现是一样的，但小说和另外两者是有明显区别的。因为后两者是readable只push一个url，然后transform只请求了一次就能获取全部内容，最后writeable异步写入就直接next了，监听finish可以返回主菜单了。这样用户等待时间只有transform里面的request一个请求。

   而下载小说的时候，你会明显看到命令行是卡住的，原因就是readable push多个，时间全部浪费在request请求完所有东西(这样做有一个好处，写入章节内容都是顺序的)。
    也就是说你下载全本的时候，你操作不了的。
