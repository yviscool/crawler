
class InputError extends Error {
    constructor(message = '输入不合法，请重新输入, ctrl + u 清除该信息') {
        super(message);
        this.name = 'InputError'
    }
}

class NovelNotFindError extends Error{
    constructor(message = '找不到该小说，输入不合法，请重新输入, ctrl + u 清除该信息') {
        super(message);
        this.name = 'NovelFindError'
    }
}


class BackError extends Error {
    constructor(message = '返回主菜单成功, ctrl + u 清除该信息') {
        super(message);
        this.name = 'BackError'
    }
}

module.exports = {
    InputError,
    NovelNotFindError,
    BackError
}