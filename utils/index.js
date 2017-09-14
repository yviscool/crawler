var Utils = function() {
    if (!(this instanceof Utils)) {
        return new Utils();
    }
    this.properArr = [ require('./pipe'), require('./commonutils'), require('./readline') ];
    this.init();
}

//把 properArr的每一个属性 赋值给 utils
Utils.prototype.init = function() {
    this.properArr.forEach(function(ele) {
        for (var key in ele) {
            this[key] = ele[key];
        }
    },this)
}

module.exports = new Utils();