'use strict';

var memdb = require('memdb-client');
var P = memdb.Promise;
var logger = memdb.logger.getLogger('timer', __filename);

var Timer = function(app, opts){
    opts = opts || {};
    this.app = app;
    this.timers = {}; // {id : timer}
};

var proto = Timer.prototype;

proto.name = 'timer';

proto.start = function(cb){
    cb();
};

proto.stop = function(force, cb){
    this.cancelAll();
    cb();
};

proto.delay = function(id, time, fn) {
    if(this.timers.hasOwnProperty(id)) {
        logger.warn('id already exists in timers map, will replace: id=%s', id);
        this.cancel(id);
    }
    this.timers[id] = setTimeout(this._wrapTimer(id, fn, true), time);
};

proto.loop = function(id, time, fn) {
    if(this.timers.hasOwnProperty(id)) {
        logger.warn('id already exists in timers map, will replace: id=%s', id);
        this.cancel(id);
    }
    this.timers[id] = setInterval(this._wrapTimer(id, fn), time);
};

proto.cancel = function(id) {
    var timer = this.timers[id];
    if(timer) {
        if(timer._repeat){
            clearInterval(timer);
        }
        else{
            clearTimeout(timer);
        }
        delete this.timers[id];
        return true;
    }
    return false;
};

proto.cancelAll = function() {
    var self = this;
    Object.keys(this.timers).forEach(function(key){
        self.cancel(key);
    });
};

proto._wrapTimer = function(id, fn, autoRemove) {
    var self = this;
    return function(){
        logger.debug('on timer: %s', id);

        return self.app.memdb.goose.transaction(fn, self.app.getServerId())
        .catch(function(e){
            logger.error(e.stack);
        })
        .finally(function(){
            if(autoRemove) {
                delete self.timers[id];
            }
        });
    };
};

module.exports = function(app, opts){
    var timer = new Timer(app, opts);
    app.set(timer.name, timer, true);
    return timer;
};