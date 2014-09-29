(function(){
    var helper = {
        "version": "v1.0",
        "author": "zhangrui",
        "latest": "20140928",
        "contact": "zhangrui(at)2lala.cn",
        "$": function(str){
            var ret = document.querySelectorAll(str);
            return ret.length == 1 ? ret[0] : ret;
        },
        "domReady": function(callback){
            this.on(window, "DOMContentLoaded", callback);
        },
        "on": function(mine, type, callback){
            mine = ([].toString.call(mine) === '[object String]' ? this.$(mine) : mine);
            mine.addEventListener(type, callback, false);
        },
        "sort": function(arr){
            var temp;
            for(var i=0; i < arr.length - 1; i++){
                for(var j=0; j < arr.length - i - 1; j++){
                    if(arr[j] > arr[j + 1]){
                        temp = arr[j];
                        arr[j] = arr[j + 1];
                        arr[j + 1] = temp;
                    }
                }
            }
            return arr;
        },
        "extend": function(s, d){
            for(var o in d){
                if(d.hasOwnProperty(o)){
                    s[o] = d[o];
                }
            }
            return s;
        }
    };
    if(typeof define === 'function'){
        define(function(){ // 提供AMD或CMD模块
            return helper;
        });
    }else{
        window.CaptchaHelper || (window.CaptchaHelper = helper); // 提供给 window
    }
})();