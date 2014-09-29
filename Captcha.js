/**
 * Created by skyperson@gmail.com on 2014/9/28.
 * Copyright (c) 2014 ZhangRui
 * MIT License
 * Example:
 *      var _c = new Captcha().bind('#img_id').painter('#canvas_id').init();
 */
;(function(){

    var captcha = function(options){
        this.options = CaptchaHelper.extend({
            matrixRadius: 1,
            medianSize: 3,
            dgGrayValue: null,
            maxNearPoints: 1
        }, options);
        return this;
    };

    captcha.prototype.bind = function(str){
        this.img = CaptchaHelper.$(str);
        return this;
    };

    captcha.prototype.painter = function(str){
        this.cvs = CaptchaHelper.$(str);
        this.ctx = this.cvs.getContext("2d");
        return this;
    };

    captcha.prototype.init = function(){
        var width = this.cvs.width = this.img.offsetWidth + this.options.matrixRadius * 2,
            height = this.cvs.height = this.img.offsetHeight + this.options.matrixRadius * 2;
        this.ctx.rect(0, 0, width, height);
        this.ctx.fillStyle = "#FFF";
        this.ctx.fill();
        this.ctx.drawImage(this.img, this.options.matrixRadius, this.options.matrixRadius);
        this.options.dgGrayValue = getDgGrayValue.call(this);
    };

    captcha.prototype.recognition = function(){
        convert.call(this, 'gray');
        convert.call(this, 'wb');
        clearNoise.call(this);
        charSplit.call(this);
        //medianFiltering.call(this);
        //threeChannelFiltering.call(this);
    };

    /* 取前景背景的临界值 */
    function getDgGrayValue(){
        var pixelNum = (function(size){
            var arr = [],i = 0;
            while(i < size){ arr[i] = 0; i++}
            return arr;
        })(256);           //图象直方图，共256个点
        var n, n1, n2;
        var total;                              //total为总和，累计值
        var m1, m2, sum, csum, fmax, sb;     //sb为类间方差，fmax存储最大方差值
        var k, t, q;
        var threshValue = 1;                      // 阈值
        var step = 1;
        //生成直方图
        for (var i =0; i < this.cvs.width ; i++){
            for (var j = 0; j < this.cvs.height; j++){
                //返回各个点的颜色，以RGB表示
                pixelNum[this.ctx.getImageData(i,j,1,1).data[0]]++;            //相应的直方图加1
            }
        }
        //直方图平滑化
        for (k = 0; k <= 255; k++){
            total = 0;
            for (t = -2; t <= 2; t++){              //与附近2个灰度做平滑化，t值应取较小的值
                q = k + t;
                if(q < 0) q = 0;                     //越界处理
                if (q > 255)q = 255;
                total = total + pixelNum[q];    //total为总和，累计值
            }
            pixelNum[k] = total / 5.0 + 0.5;    //平滑化，左边2个+中间1个+右边2个灰度，共5个，所以总和除以5，后面加0.5是用修正值
        }
        //求阈值
        sum = csum = 0.0;
        n = 0;
        //计算总的图象的点数和质量矩，为后面的计算做准备
        for (k = 0; k <= 255; k++){
            sum += k * pixelNum[k];     //x*f(x)质量矩，也就是每个灰度的值乘以其点数（归一化后为概率），sum为其总和
            n += pixelNum[k];                       //n为图象总的点数，归一化后就是累积概率
        }

        fmax = -1.0;                          //类间方差sb不可能为负，所以fmax初始值为-1不影响计算的进行
        n1 = 0;
        for (k = 0; k < 256; k++){                  //对每个灰度（从0到255）计算一次分割后的类间方差sb
            n1 += pixelNum[k];                //n1为在当前阈值遍前景图象的点数
            if (n1 == 0) { continue; }            //没有分出前景后景
            n2 = n - n1;                        //n2为背景图象的点数
            if (n2 == 0) { break; }               //n2为0表示全部都是后景图象，与n1=0情况类似，之后的遍历不可能使前景点数增加，所以此时可以退出循环
            csum += k * pixelNum[k];    //前景的“灰度的值*其点数”的总和
            m1 = csum / n1;                     //m1为前景的平均灰度
            m2 = (sum - csum) / n2;               //m2为背景的平均灰度
            sb = n1 * n2 * (m1 - m2) * (m1 - m2);   //sb为类间方差
            if (sb > fmax){                  //如果算出的类间方差大于前一次算出的类间方差
                fmax = sb;                    //fmax始终为最大类间方差（otsu）
                threshValue = k;              //取最大类间方差时对应的灰度的k就是最佳阈值
            }
        }
        return threshValue;
    }

    /* 图片去噪 */
    function clearNoise(){
        var piexl;
        var nearDots = 0;
        var XSpan, YSpan, tmpX, tmpY;
        //逐点判断
        for (var i = 0; i < this.cvs.width; i++){
            for (var j = 0; j < this.cvs.height; j++){
                piexl = this.ctx.getImageData(i, j, 1, 1); //.GetPixel(i, j);
                if (piexl.data[0] < this.options.dgGrayValue){
                    nearDots = 0;
                    //判断周围8个点是否全为空
                    if (i == 0 || i == this.cvs.width - 1 || j == 0 || j == this.cvs.height - 1){  //边框全去掉
                        this.ctx.putImageData(piexl, i, j); //.SetPixel(i, j, Color.FromArgb(255, 255, 255));
                    } else {
                        if (this.ctx.getImageData(i - 1, j - 1, 1, 1).data[0] < this.options.dgGrayValue) nearDots++;
                        if (this.ctx.getImageData(i, j - 1, 1, 1).data[0] < this.options.dgGrayValue) nearDots++;
                        if (this.ctx.getImageData(i + 1, j - 1, 1, 1).data[0] < this.options.dgGrayValue) nearDots++;
                        if (this.ctx.getImageData(i - 1, j, 1, 1).data[0] < this.options.dgGrayValue) nearDots++;
                        if (this.ctx.getImageData(i + 1, j, 1, 1).data[0] < this.options.dgGrayValue) nearDots++;
                        if (this.ctx.getImageData(i - 1, j + 1, 1, 1).data[0] < this.options.dgGrayValue) nearDots++;
                        if (this.ctx.getImageData(i, j + 1, 1, 1).data[0] < this.options.dgGrayValue) nearDots++;
                        if (this.ctx.getImageData(i + 1, j + 1, 1, 1).data[0] < this.options.dgGrayValue) nearDots++;
                    }

                    if (nearDots < this.options.maxNearPoints){
                        piexl.data[0] = 255;
                        piexl.data[1] = 255;
                        piexl.data[2] = 255;
                        this.ctx.putImageData(piexl, i, j);   //去掉单点 && 粗细小3邻边点  : , Color.FromArgb(255, 255, 255)
                    }
                } else {  //背景
                    piexl.data[0] = 255;
                    piexl.data[1] = 255;
                    piexl.data[2] = 255;
                    this.ctx.putImageData(piexl, i, j);   //bmpobj.SetPixel(i, j, Color.FromArgb(255, 255, 255));
                }
            }
        }
        return this;
    }

    /* 快速单通道中值滤波 两种滤波效果差不多 灰度滤波 */
    function medianFiltering(){
        var p = [],
            _pixel,
            _tmp;

        for (var y = 1; y < this.cvs.height - 1; y++){
            for (var x = 1; x < this.cvs.width - 1; x++){
                //取9个点的值
                p[0] = this.ctx.getImageData(x - 1, y - 1, 1, 1).data[0];
                p[1] = this.ctx.getImageData(x, y - 1, 1, 1).data[0];
                p[2] = this.ctx.getImageData(x + 1, y - 1, 1, 1).data[0];
                p[3] = this.ctx.getImageData(x - 1, y, 1, 1).data[0];
                p[4] = this.ctx.getImageData(x, y, 1, 1).data[0];
                p[5] = this.ctx.getImageData(x + 1, y, 1, 1).data[0];
                p[6] = this.ctx.getImageData(x - 1, y + 1, 1, 1).data[0];
                p[7] = this.ctx.getImageData(x, y + 1, 1, 1).data[0];
                p[8] = this.ctx.getImageData(x + 1, y + 1, 1, 1).data[0];
                //计算中值
                for (var j = 0; j < 5; j++){
                    for (var i = j + 1; i < 9; i++){
                        if (p[j] > p[i]){
                            _tmp = p[j];
                            p[j] = p[i];
                            p[i] = _tmp;
                        }
                    }
                }
                _pixel = this.ctx.getImageData(x, y, 1, 1);
                _pixel.data[0] = p[4];
                _pixel.data[1] = p[4];
                _pixel.data[2] = p[4];
                this.ctx.putImageData(_pixel, x, y);
            }
        }
        return this;
    }

    /* 慢速三通道中值滤波 如果需要保留色彩则使用三通道滤波 */
    function threeChannelFiltering(){
        var _height = this.cvs.height,
            _width = this.cvs.width,
            _minOfMax,
            _medOfMed,
            _maxOfMin,
            _medOfNice,
            _row = [],
            _pixel,
            _borderSize = (this.options.medianSize - 1) / 2,
            _medianValue = function(arr){
                //中值
                arr = CaptchaHelper.sort(arr, 0, arr.length);   //中间值
                return arr[(arr.length - 1) / 2];

                //均值
                //var ret = 0;
                //for(var i = 0; i < arr.length; i++){
                //    ret+=arr[i];
                //}
                //return ret/arr.length;
            },
            mine = this;

        for( var i = _borderSize; i < _height - _borderSize; i++){
            for(var j = _borderSize; j < _width - _borderSize; j++){
                for(var m = 0; m < 3; m++){
                    for(var k = 0; k < mine.options.medianSize; k++){
                        _row[k] = [];
                        for(var l = 0; l < mine.options.medianSize; l++){
                            var left = j - _borderSize + l,
                                top = i - _borderSize + k;
                            _pixel = mine.ctx.getImageData(left, top, 1, 1);
                            _row[k][l] = _pixel.data[m];
                        }
                    }

                    _minOfMax = Math.min.apply(null,(function(){
                        var ret = [];
                        for(var m = 0; m < mine.options.medianSize; m++){
                            ret.push(Math.max.apply(null,_row[m]));
                        }
                        return ret;
                    })());

                    _medOfMed = _medianValue((function(){
                        var ret = [];
                        for(var m = 0; m < mine.options.medianSize; m++){
                            ret.push(_medianValue(_row[m]));
                        }
                        return ret;
                    })());

                    _maxOfMin = Math.max.apply(null,(function(){
                        var ret = [];
                        for(var m = 0; m < mine.options.medianSize; m++){
                            ret.push(Math.min.apply(null,_row[m]));
                        }
                        return ret;
                    })());

                    _medOfNice = _medianValue([_minOfMax, _medOfMed, _maxOfMin]);
                    _pixel = mine.ctx.getImageData(j, i, 1, 1);
                    _pixel.data[m] = _medOfNice;
                    mine.ctx.putImageData(_pixel, j, i);
                }
            }
        }
        return this;
    }

    /* 转换为灰度或二值化 */
    function convert(type){ //gray,wb
        var mine = this;
        var __effect = {
            "gray": function(r,g,b){
                return parseFloat(r * 299 / 1000 + g * 587 / 1000 + b * 114 / 1000);
            },
            "wb": function(r,g,b){
                return parseInt((r + g + b) / 3) > mine.options.dgGrayValue ? 255 : 0;
            }
        };

        var _image = mine.ctx.getImageData(0, 0, mine.cvs.width, mine.cvs.height),
            _imageSize = mine.cvs.width * mine.cvs.height;

        for (var i = 0; i < _imageSize * 4; i += 4) {
            var _red = _image.data[i];
            var _green = _image.data[i + 1];
            var _blue = _image.data[i + 2];
            var _imageData = __effect[type](_red, _green, _blue);

            _image.data[i] = _imageData;
            _image.data[i + 1] = _imageData;
            _image.data[i + 2] = _imageData;
        }

        mine.ctx.putImageData(_image, 0, 0);
        return mine;
    }

    /* 字符拆分 */
    function charSplit(){
        var _height = this.cvs.height,
            _width = this.cvs.width,
            _cols = [];

        for(var i = 0; i < _width; i++){
            _cols[i] = 0;
            for(var j = 0; j < _height; j++){
                _cols[i] += this.ctx.getImageData(i, j, 1, 1).data[0] == 255 ? 0 : 1;
            }
            console.log("col" + i + ":" + _cols[i]);
        }
    }

    if(typeof define === 'function'){
        define(function(){
            return captcha;
        });
    }else{
        window.Captcha || (window.Captcha = captcha);
    }

})();