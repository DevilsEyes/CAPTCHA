/**
 * Created by skyperson@gmail.com on 2014/9/28.
 * Copyright (c) ZhangRui
 * MIT Licensed
 * Example:
 *      var _c = new Captcha().bind('#img_id').painter('#canvas_id').init();
 *
 * TODO:
 *      1、目前图像取值性能太低，需要优化
 */
;(function(){

    var captcha = function(options){
        this.options = CaptchaHelper.extend({
            matrixRadius: 1,      // 矩阵半径，用于给 Canvas 处理时留边
            medianSize: 3,       // 滤波处理时的操作半径
            dgGrayValue: null,     // 北京临界值
            maxNearPoints: 1       // 允许像素周围最多有多少噪点
        }, options);
        return this;
    };

    var fn = captcha.prototype;

    fn.bind = function(str){
        this.img = CaptchaHelper.$(str);
        return this;
    };

    fn.painter = function(str){
        this.cvs = CaptchaHelper.$(str);
        this.ctx = this.cvs.getContext("2d");
        return this;
    };

    fn.init = function(){
        // 初始化整个 Canvas
        var width = this.cvs.width = this.img.offsetWidth + this.options.matrixRadius * 2,
            height = this.cvs.height = this.img.offsetHeight + this.options.matrixRadius * 2;
        this.ctx.rect(0, 0, width, height);
        this.ctx.fillStyle = "#FFF";
        this.ctx.fill();
        this.ctx.drawImage(this.img, this.options.matrixRadius, this.options.matrixRadius);
        this.imageMatrix = this.ctx.getImageData(0, 0, this.cvs.width, this.cvs.height).data;   // 保存原始数据至矩阵
        this.options.dgGrayValue = getDgGrayValue.call(this); // 获取前景与背景的临界值
    };

    // 进行识别的处理逻辑，本次只应用手写识别，所以只开启二值化与字符拆分
    fn.recognition = function(){
        //convert.call(this, 'gray');           // 进行灰度处理
        convert.call(this, 'wb');           // 进行二值化处理
        //clearNoise.call(this);           // 进行降噪处理
        charSplit.call(this);           // 进行字符拆分处理
        //medianFiltering.call(this);           // 进行中值滤波处理
        //threeChannelFiltering.call(this);           // 进行三通道滤波处理
    };

    // 加这个是考虑性能问题，直接用 DOM 接口取值会严重降低性能
    // 最后一个参数设置按照原始数据输出
    fn.getImageMatrix = function(x, y, w, h, raw){
        var width = this.cvs.width,
            height = this.cvs.height,
            i, j, ret = [],
            image = this.imageMatrix || this.ctx.getImageData(0, 0, width, height).data;   // 原始图片数据
        raw = typeof(raw) == 'undefined' ? false : raw;

        w = w || 1;
        h = h || 1;

        for(j = y * width * 4; j < (y + h) * width * 4; j += width * 4){  // 计算对应的行数
            for(i = x * 4; i < (x + w) * 4; i += 4){       // 计算对应的列数
                if(raw){                            // 如果需要返回原始结构，就将原始的序列返回
                    ret.push(image[j + i]);
                    ret.push(image[j + i + 1]);
                    ret.push(image[j + i + 2]);
                    ret.push(image[j + i + 3]);
                }else{
                    ret.push({                       // 添加像素信息，保存的是RGBA信息
                        red: image[j + i],
                        green: image[j + i + 1],
                        blue: image[j + i + 2],
                        alpha: image[j + i + 3]
                    });
                }
            }
        }
        return ret;
    };

    /* 取前景背景的临界值 */
    /*
        涉及的知识：
            类间方差（graythresh）：http://baike.baidu.com/view/7172489.htm
            直方图：http://baike.baidu.com/item/直方图/1103834
     */
    function getDgGrayValue(){
        var pixelNum = (function(size){
            var arr = [],i = 0;
            while(i < size){ arr[i] = 0; i++}
            return arr;
        })(256); //初始化图象直方图，共256个点，填充0
        var n, n1, n2;
        var total; //total为总和，累计值
        var m1, m2, sum, csum, fmax, sb; //sb为类间方差，fmax存储最大方差值
        var k, t, q;
        var threshValue = 1; // 阈值
        //生成直方图
        for (var i =0; i < this.cvs.width ; i++){
            for (var j = 0; j < this.cvs.height; j++){ //返回各点的颜色，以RGB表示
                pixelNum[this.getImageMatrix(i,j,1,1)[0].red]++; //相应的直方图加1
            }
        }
        //直方图平滑化
        for (k = 0; k <= 255; k++){
            total = 0;
            for (t = -2; t <= 2; t++){ //与附近2个灰度做平滑化，t值应取较小的值
                q = k + t;
                if(q < 0) q = 0; //越界处理
                if (q > 255)q = 255;
                total = total + pixelNum[q]; //total为总和，累计值
            }
            pixelNum[k] = total / 5.0 + 0.5; //平滑化，左边2个+中间1个+右边2个灰度，共5个，所以总和除以5，后面加0.5是用修正值
        }
        //求阈值
        sum = csum = 0.0;
        n = 0;
        //计算总的图象的点数和质量矩，为后面的计算做准备
        for (k = 0; k <= 255; k++){
            sum += k * pixelNum[k]; //x*f(x)质量矩，也就是每个灰度的值乘以其点数（归一化后为概率），sum为其总和
            n += pixelNum[k]; //n为图象总的点数，归一化后就是累积概率
        }

        fmax = -1.0; //类间方差sb不可能为负，所以fmax初始值为-1不影响计算的进行
        n1 = 0;
        for (k = 0; k < 256; k++){    //对每个灰度（从0到255）计算一次分割后的类间方差sb
            n1 += pixelNum[k];        //n1为在当前阈值遍前景图象的点数
            if (n1 == 0) { continue; }     //没有分出前景后景
            n2 = n - n1;           //n2为背景图象的点数
            if (n2 == 0) { break; }       //n2为0表示全部都是后景图象，与n1=0情况类似，之后的遍历不可能使前景点数增加，所以此时可以退出循环
            csum += k * pixelNum[k];     //前景的“灰度的值*其点数”的总和
            m1 = csum / n1;     //m1为前景的平均灰度
            m2 = (sum - csum) / n2;       //m2为背景的平均灰度
            sb = n1 * n2 * (m1 - m2) * (m1 - m2);    //sb为类间方差
            if (sb > fmax){     //如果算出的类间方差大于前一次算出的类间方差
                fmax = sb;      //fmax始终为最大类间方差（otsu）
                threshValue = k;   //取最大类间方差时对应的灰度的k就是最佳阈值
            }
        }
        return threshValue;
    }

    /* 图片去噪 */
    // TODO 这里也需要优化，效率太特么低下了
    function clearNoise(){
        var piexl;
        var nearDots = 0;
        //逐点判断
        for (var i = 0; i < this.cvs.width; i++){   // 遍历宽度
            for (var j = 0; j < this.cvs.height; j++){  // 遍历高度
                piexl = this.ctx.getImageData(i, j, 1, 1); //.GetPixel(i, j);   取每点像素
                if (piexl.data[0] < this.options.dgGrayValue){   // 如果是有效点，开始判断周围的点是否有噪音
                    nearDots = 0;
                    //判断周围8个点是否全为空
                    if (i == 0 || i == this.cvs.width - 1 || j == 0 || j == this.cvs.height - 1){  //边框全去掉
                        this.ctx.putImageData(piexl, i, j); //.SetPixel(i, j, Color.FromArgb(255, 255, 255));
                    } else {
                        if (this.getImageMatrix(i - 1, j - 1, 1, 1)[0].red < this.options.dgGrayValue) nearDots++;
                        if (this.getImageMatrix(i, j - 1, 1, 1)[0].red < this.options.dgGrayValue) nearDots++;
                        if (this.getImageMatrix(i + 1, j - 1, 1, 1)[0].red < this.options.dgGrayValue) nearDots++;
                        if (this.getImageMatrix(i - 1, j, 1, 1)[0].red < this.options.dgGrayValue) nearDots++;
                        if (this.getImageMatrix(i + 1, j, 1, 1)[0].red < this.options.dgGrayValue) nearDots++;
                        if (this.getImageMatrix(i - 1, j + 1, 1, 1)[0].red < this.options.dgGrayValue) nearDots++;
                        if (this.getImageMatrix(i, j + 1, 1, 1)[0].red < this.options.dgGrayValue) nearDots++;
                        if (this.getImageMatrix(i + 1, j + 1, 1, 1)[0].red < this.options.dgGrayValue) nearDots++;
                    }

                    if (nearDots < this.options.maxNearPoints){    // 如果周围噪点小于规定的最大噪点阈值，标记为空点
                        piexl.data[0] = 255;
                        piexl.data[1] = 255;
                        piexl.data[2] = 255;
                        this.ctx.putImageData(piexl, i, j);   // 去掉噪点 && 粗细小3邻边点
                    }
                } else {  //否则标记为空点
                    piexl.data[0] = 255;
                    piexl.data[1] = 255;
                    piexl.data[2] = 255;
                    this.ctx.putImageData(piexl, i, j);
                }
            }
        }
        return this;
    }

    /* 快速单通道中值滤波 两种滤波效果差不多 灰度滤波 */
    // TODO 这里也需要优化，效率太特么低下了
    function medianFiltering(){
        var p = [],
            _pixel,
            _tmp;

        for (var y = 1; y < this.cvs.height - 1; y++){
            for (var x = 1; x < this.cvs.width - 1; x++){
                //取9个点的值，分别对应：
                // 0 1 2
                // 3 4 5
                // 6 7 8
                p[0] = this.ctx.getImageData(x - 1, y - 1, 1, 1).data[0];
                p[1] = this.ctx.getImageData(x, y - 1, 1, 1).data[0];
                p[2] = this.ctx.getImageData(x + 1, y - 1, 1, 1).data[0];
                p[3] = this.ctx.getImageData(x - 1, y, 1, 1).data[0];
                p[4] = this.ctx.getImageData(x, y, 1, 1).data[0];
                p[5] = this.ctx.getImageData(x + 1, y, 1, 1).data[0];
                p[6] = this.ctx.getImageData(x - 1, y + 1, 1, 1).data[0];
                p[7] = this.ctx.getImageData(x, y + 1, 1, 1).data[0];
                p[8] = this.ctx.getImageData(x + 1, y + 1, 1, 1).data[0];
                // 将灰度值进行快速排序
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
                this.ctx.putImageData(_pixel, x, y); // 绘制计算好的中值
            }
        }
        return this;
    }

    /* 慢速三通道中值滤波 如果需要保留色彩则使用三通道滤波 */
    // TODO 这里也需要优化，效率太特么低下了
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
                //中值 <-- 经过测试，发现使用中值的效果更好一些
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
                for(var m = 0; m < 3; m++){                                     // RGB 3通道
                    for(var k = 0; k < mine.options.medianSize; k++){               // 计算中值滤波半径宽
                        _row[k] = [];
                        for(var l = 0; l < mine.options.medianSize; l++){               // 计算中值滤波半径高
                            var left = j - _borderSize + l,
                                top = i - _borderSize + k;
                            _pixel = mine.ctx.getImageData(left, top, 1, 1);              // 取出矩阵数据
                            _row[k][l] = _pixel.data[m];
                        }
                    }

                    _minOfMax = Math.min.apply(null,(function(){         // 取最大值里最小的
                        var ret = [];
                        for(var m = 0; m < mine.options.medianSize; m++){
                            ret.push(Math.max.apply(null,_row[m]));
                        }
                        return ret;
                    })());

                    _medOfMed = _medianValue((function(){         // 取中值里中间的
                        var ret = [];
                        for(var m = 0; m < mine.options.medianSize; m++){
                            ret.push(_medianValue(_row[m]));
                        }
                        return ret;
                    })());

                    _maxOfMin = Math.max.apply(null,(function(){         // 取最小值里最大的
                        var ret = [];
                        for(var m = 0; m < mine.options.medianSize; m++){
                            ret.push(Math.min.apply(null,_row[m]));
                        }
                        return ret;
                    })());

                    _medOfNice = _medianValue([_minOfMax, _medOfMed, _maxOfMin]);    // 取出各值里边最好的中值
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
            "gray": function(r,g,b){            // 去色，变为灰度。 299 587 114 这几个数据是求灰度最接近的阈值
                return parseFloat(r * 299 / 1000 + g * 587 / 1000 + b * 114 / 1000);
            },
            "wb": function(r,g,b){            // 二值化，使用 RGB 三色的灰度平均值与获取到的临界值进行二值化处理
                return parseInt((r + g + b) / 3) > mine.options.dgGrayValue ? 255 : 0;
            }
        };

        var _image = mine.ctx.getImageData(0, 0, mine.cvs.width, mine.cvs.height),
            _imageSize = mine.cvs.width * mine.cvs.height;

        for (var i = 0; i < _imageSize * 4; i += 4) {
            var _red = _image.data[i];               // 红色位
            var _green = _image.data[i + 1];               // 绿色位
            var _blue = _image.data[i + 2];               // 蓝色位
            var _imageData = __effect[type](_red, _green, _blue);

            _image.data[i] = _imageData;
            _image.data[i + 1] = _imageData;
            _image.data[i + 2] = _imageData;
        }

        this.imageMatrix = _image.data;  // 将已处理的原始数据存入矩阵
        mine.ctx.putImageData(_image, 0, 0);
        return mine;
    }

    /* 字符拆分 */
    function charSplit(){
        var _this = this;
        function getAllRowsMatrix(){
            var _height = _this.cvs.height,
                _width = _this.cvs.width,
                _matrixs = [],  // 保存拆分后的矩阵
                _rows = [],  // 用于保存行内像素值总和
                _rowArray = [], // 用于保存行矩阵
                _pixel = 0,   // 像素值
                _blockFlag = false, // 块标记
                _blockArray = []; // 块矩阵

            for(var i = 0; i < _height; i++){         // 遍历图片高度进行分拆
                _rows[i] = 0;
                if(_blockFlag == false){         // 如果块标记为flase，表示当前块已结束，需要重新进行计算
                    _rowArray = [];
                }
                for(var j = 0; j < _width; j++){         // 遍历列，需要取到当前行里边是否有有效地像素
                    _pixel = _this.getImageMatrix(j, i, 1, 1)[0].red == 255 ? 0 : 1;
                    _rows[i] += _pixel;
                    _rowArray.push(_pixel);
                }
                if(_blockFlag == true && _rows[i] === 0){         // 如果块标记为 true ，表示当前在块中。但如果当前行没有可用像素，就表示当前块已经结束，将块推入矩阵
                    _matrixs.push(_blockArray);
                }
                if(_rows[i] !== 0){         // 如果当前行存在有效像素就推入块矩阵
                    _blockFlag = true;
                    _blockArray.push(_rowArray);
                }else{
                    _blockFlag = false;
                    _blockArray = [];
                }
            }
            return _matrixs;
        }

        console.log("_matrixs", getAllRowsMatrix());
    }

    if(typeof define === 'function'){
        define(function(){
            return captcha;
        });
    }else{
        window.Captcha || (window.Captcha = captcha);
    }

})();