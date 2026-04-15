var headerUrl = 'https://bi.cabio.cn:9003/oss/lab'

 /**
 * @func 单选组件取值
 * @desc 2023-04-20
 * @returns {string} string 返回 选项值，若是“其它选项”则返回 其它(***) 格式
 * @param {obj} comp 组件值
*/
function getRadioVal(comp) {
    if (comp && typeof comp == "object") {
        var obj = comp
        var str = ''
        var val = obj["val"]
        if (obj && val) {
            str += val
        }
        if (val == '其他' || val == '其它' ) {
            str += ' ('+ obj["valOther"] + ')'
        }
        return str
    } else if (comp && typeof comp === "string"){
        return comp
    } else {
        return ''
    }
}


// 空白值时填充
function checkDefaultData(targetObj, defaultStr) {
    Object.keys(targetObj).forEach(function (key, index) {
        var value = targetObj[key];
        if (value === undefined || value === null || value === "") {
            targetObj[key] = defaultStr;
        }
    })
}

//根据结果获取有效位数
//2020707-LIANGJIAMING
function getResultDgits(value){
    if (isNaN(Number(value))) {
        return 3
    }
    var str = String(value).replace('.', '')
    var digits = 0
    for(var i = 0; i < str.length; i++){
        if(Number(str[i])){
            digits = str.length - i
            break;
        }
    }
    return digits
}

//平均值计算，最后输出的是有效位数，用银行家法修约
//2020-07-18
//calcAverageVal修改
function effectiveAverageVal(arr, digits) {
    var filterArr = filterCalcArr(arr)  // 得到可计算的数组
    // 求过滤后数组的平均
    var aver = filterArr.length ? filterArr.reduce(function(a, b) { return (+a) + (+b)}) / filterArr.length : ''
    var d
    // 如果传入的小数位数，不是字符串也不是数字，或转换成数字变成NaN，或有小数位数时，则通过代码在数组内找一个小数位数
    if (['string', 'number'].indexOf(typeof digits) === -1 || isNaN(Number(digits)) || String(digits).indexOf('.') > -1) {
        // 得到默认的小数位数
        d = findDigitsFromArr(filterArr)
    } else {
        d = Number(digits)
    }
    return aver ? aver.toPrecisionBank(d) : '' // 保留小数位，传入或者从数组里面找一个
}

//检出限判断
//20200413-LIANGJIAMING
function limitJudgment(value,limit){
    //判断检测限是否是数字，如果是就进行判断，不是就返回原值
    if(emptyValTransformEmptyString(value)!=''){
        if(typeof(Number(limit))=="number"){
            if(Number(value)<Number(limit)){
                value = 'ND'
            }
            return value
        }
    }
    return value
}

//求一数字数组的元素总和
function arrSum(arr){
    var sum = 0
    if(arr!=null){
        arr.forEach(function(item){
            if(Number(item)!=NaN){
                sum += Number(item)
            }
        });
    }
    return sum
}
//求一数字数组的元素总和平均
function arrSumAvg(arr){
    var sum = 0
    var conut = 0
    if(arr!=null){
        arr.forEach(function(item){
            if(Number(item)!=NaN){
                sum += Number(item)
                count += 1
            }
        });
    }
    return sum/count
}

//比较日期大小，传入一个{日期:日期时间戳}对象
//20200413-LIANGJIAMING
function dateCompare(dateObj){
    var maxTimestamp = 0
    var minTimestamp = 0
    var val = {
        maxDate:'',
        minDate:''
    }
    for(var i in dateObj){
        var num = dateObj[i]
        if(i == ""){
            continue
        }
        if(num>maxTimestamp){
            maxTimestamp = num
            val.maxDate = i
        }
        if(num<minTimestamp||minTimestamp == 0){
            minTimestamp = num
            val.minDate = i
        }
    }
    return val
}

// 定位组件单位转换 - LIANGJIAMING
function formatDegree(val) {
    var value = Math.abs(val);
    var v1 = Math.floor(value);//度
    var v2 = Math.floor((value - v1) * 60);//分
    var v3 = Math.round((value - v1) * 3600 % 60);//秒
    return v1 + '°' + v2 + '\'' + v3 + '\"';
}

/**
 * @author: LIANGJIAMING YangSenJie LiuXinYing(2020-4-24)
 * @func 自动转换科学计数法
 * @desc 2020-04-21
 * @returns {string} html字符串
 * @param {number} num - 被修改的数据
 * @param {number} digit - 需要传入该数值的有效位数
 */
function scientificNotation(num, digit){
    if(num == 'ND' || num == '/' || num == null || num == ''){
        return num
    }
    if(digit != 0 && digit == null){
        digit = 2
    }
    var newNum = Number(num)
    var scientificNum = newNum.toExponential(digit)
    var val = scientificNum+''
    var numIndex = val.indexOf('e')-1
    var powerIndex = val.indexOf('e')+1
    var numVal = val.substring(0,numIndex)
    var powerVal = val.substring(powerIndex)
    if(powerVal.indexOf('+')>=0){
        powerVal = powerVal.substring(powerVal.indexOf('+')+1)
    }
    return numVal + '×10' + powerVal.sup()

    return num
}

/**
 * @author: LIANGJIAMING YangSenJie(2020-4-24)
 * @func 根据范围自动转换科学计数法
 * @desc 2020-04-21
 * @returns {string} html字符串
 * @param num  - 被修改的数据
 * @param {number} digit  - 需要传入该数值的有效位数
 * @param {number} up  - 范围最大值
 * @param {number} down  - 范围最小值
 */
function numScientificCounting(num,digit,up,down){
    if(num == 'ND' || num == '/' || num == null || num == ''){
        return num
    }
    if(digit != 0 && digit == null){
        digit = 2
    }
    if ((up != 0) && !up) {
        up = 1000
    }
    if ((down != 0) && !down) {
        down = 0.001
    }
    var newNum = Number(num)
    if((newNum>up || newNum<down)&&newNum!=0){
        var scientificNum = newNum.toExponential(digit)
        var val = scientificNum+''
        var numIndex = val.indexOf('e')-1
        var powerIndex = val.indexOf('e')+1
        var numVal = val.substring(0,numIndex)
        var powerVal = val.substring(powerIndex)
        if(powerVal.indexOf('+')>=0){
            powerVal = powerVal.substring(powerVal.indexOf('+')+1)
        }
        return numVal + '×10' + powerVal.sup()
    }
    return num
}

/**
 * @function 根据银行家舍入法（四舍六入五留双）取有效位数
 * @author YangSenJie
 * @desc 2020-04-24 参考项目中的公式编辑的SIGFIG公式
 * @param {number} digit
 */
Number.prototype.toPrecisionBank = function (digit) {

    function displaySigFigs(f, sigFigs, sigDecs, scientific){
        var s = "" + f;
        var order = parseOrder(s);
        var mantissa = parseMantissa(s);
        var positive = parseSign(s);
        var add;
        var decAdd;
        var sigAdd;
        var zeroScientific=false;
        if (f == 0 || mantissa=="" || mantissa=="0"){
            mantissa = "";
            for (i=0; i<sigFigs; i++){
                mantissa += "0";
            }
            order = sigFigs + sigDecs;
            if (sigDecs < 0 && -sigDecs >= sigFigs){
                zeroScientific = true;
            }
        } else {
            decAdd = ((order - mantissa.length) - sigDecs);
            sigAdd = sigFigs - mantissa.length;
            add = Math.min(sigAdd, decAdd);
            if (add < 0){
                var rounded = round(mantissa, -add);
                if (rounded.length > mantissa.length + add){
                    order++;
                    if (decAdd > sigAdd){
                        rounded = round(rounded, 1);
                    }
                }
                mantissa=rounded;
            } else if (add > 0){
                for (i=0; i<add; i++){
                    mantissa += '0';
                }
            }
            if (mantissa=="" || mantissa=="0"){
                mantissa = "0";
                positive = true;
                order = 1 + sigDecs;
                if (order != 0){
                    zeroScientific = true;
                }
            }
        }
        var useScientific = (scientific || mantissa.length > 20 || order > 21 || order < -5 ||
            (order - mantissa.length > 0 && trailingZeros(mantissa) > 0) || zeroScientific);
        var returnVal = "";
        if (!positive){
            returnVal += "-";
        }
        if (useScientific) {
            returnVal += mantissa.charAt(0);
            if (mantissa.length > 1){
                returnVal += '.' + mantissa.substring(1, mantissa.length);
            }
            if (order-1!=0){
                returnVal += "e" + (order-1);
            }
        } else {
            var wholePart = "";
            var fractPart = "";
            var needDot = true;
            if (order > 0){
                if (mantissa.length > order){
                    wholePart = mantissa.substring(0, order);
                    fractPart = mantissa.substring(order, mantissa.length);
                } else {
                    wholePart = mantissa;
                    needDot = (trailingZeros(mantissa) != 0);
                    for(var i=0; i<order-mantissa.length; i++){
                        wholePart += "0";
                    }
                }
            } else {
                for(i=0; i<-order; i++){
                    fractPart += "0";
                }
                fractPart += mantissa
            }
            returnVal += (
                (wholePart==""?"0":wholePart) + (needDot?".":"") + fractPart

            );
        }
        return (returnVal);
    }

    function trailingZeros(mantissa){
        var zeros = 0;
        for (var i=mantissa.length-1; i>=0; i--){
            var c = mantissa.charAt(i);
            if (c=='0'){
                zeros++;
            } else {
                return zeros;
            }
        }
        return zeros;
    }

    function parseSign(s){
        var beginning = true;
        var seenDot = false;
        var seenSomething = false;
        var zeros = "";
        var leadZeros = "";
        var all = "";
        var decPlaces = 0;
        var totalDecs = 0;
        var pos = true;
        for (var i=0; i<s.length; i++){
            var c = s.charAt(i);
            if (c>='1' && c<='9'){
                all += zeros + c;
                zeros = "";
                seenSomething = true;
                if (!seenDot){
                    totalDecs++;
                    decPlaces++;
                }
                beginning = false;
            } else if (c=='0'){
                if (seenDot){
                    if (seenSomething){
                        all += zeros + c;
                        zeros = "";
                    } else {
                        leadZeros += c;
                        decPlaces--;
                    }
                } else {
                    totalDecs++;
                    if (seenSomething){
                        leadZeros += c;
                        decPlaces++;
                        zeros += c;
                    } else {
                        leadZeros += c;
                    }
                }
                beginning = false
            } else if (!seenDot && c=='.'){
                all += zeros;
                zeros = "";
                seenDot=true;
                beginning = false;
            } else if (c=='e' || c=='E' && i+1<s.length){
                var raised = parseInt(s.substring(i+1, s.length));
                decPlaces += raised;
                totalDecs += raised;
                i = s.length;
            } else if (beginning && (c=='+' || c=='-')){
                if (c=='-'){
                    pos = !pos;
                }
            }
        }
        if (all == ""){
            return(true);
        } else {
            return(pos);
        }
    }

    function parseMantissa(s){
        var beginning = true;
        var seenDot = false;
        var seenSomething = false;
        var zeros = "";
        var leadZeros = "";
        var all = "";
        var decPlaces = 0;
        var totalDecs = 0;
        var pos = true;
        for (var i=0; i<s.length; i++){
            var c = s.charAt(i);
            if (c>='1' && c<='9'){
                all += zeros + c;
                zeros = "";
                seenSomething = true;
                if (!seenDot){
                    totalDecs++;
                    decPlaces++;
                }
                beginning = false;
            } else if (c=='0'){
                if (seenDot){
                    if (seenSomething){
                        all += zeros + c;
                        zeros = "";
                    } else {
                        leadZeros += c;
                        decPlaces--;
                    }
                } else {
                    totalDecs++;
                    if (seenSomething){
                        leadZeros += c;
                        decPlaces++;
                        zeros += c;
                    } else {
                        leadZeros += c;
                    }
                }
                beginning = false;
            } else if (!seenDot && c=='.'){
                all += zeros;
                zeros = "";
                seenDot=true;
                beginning = false;
            } else if (c=='e' || c=='E' && i+1<s.length){
                var raised = parseInt(s.substring(i+1, s.length));
                decPlaces += raised;
                totalDecs += raised;
                i = s.length;
            } else if (beginning && (c=='+' || c=='-')){
                if (c=='-'){
                    pos = !pos;
                }
            }
        }
        if (all == ""){
            return leadZeros;
        } else {
            return all;
        }
    }

    function parseOrder(s){
        var beginning = true;
        var seenDot = false;
        var seenSomething = false;
        var zeros = "";
        var leadZeros = "";
        var all = "";
        var decPlaces = 0;
        var totalDecs = 0;
        var pos = true;
        for (var i=0; i<s.length; i++){
            var c = s.charAt(i);
            if (c>='1' && c<='9'){
                all += zeros + c;
                zeros = "";
                seenSomething = true;
                if (!seenDot){
                    totalDecs++;
                    decPlaces++;
                }
                beginning = false;
            } else if (c=='0'){
                if (seenDot){
                    if (seenSomething){
                        all += zeros + c;
                        zeros = "";
                    } else {
                        leadZeros += c;
                        decPlaces--;
                    }
                } else {
                    totalDecs++;
                    if (seenSomething){
                        leadZeros += c;
                        decPlaces++;
                        zeros += c;
                    } else {
                        leadZeros += c;
                    }
                }
                beginning = false
            } else if (!seenDot && c=='.'){
                all += zeros;
                zeros = "";
                seenDot=true;
                beginning = false;
            } else if (c=='e' || c=='E' && i+1<s.length){
                var raised = parseInt(s.substring(i+1, s.length));
                decPlaces += raised;
                totalDecs += raised;
                i = s.length;
            } else if (beginning && (c=='+' || c=='-')){
                if (c=='-'){
                    pos = !pos;
                }
            }
        }
        if (all == ""){
            return totalDecs;
        } else {
            return decPlaces;
        }
    }

    function round(mantissa, digits){
        var last = mantissa.length - digits - 1;
        if (last < 0){
            return("");
        } else if (last >= mantissa.length -1){
            return(mantissa);
        } else {
            var nextToLast = mantissa.charAt(last+1);
            var lastChar = mantissa.charAt(last);
            var roundUp = false;
            if (nextToLast > '5') {
                roundUp = true;
            } else if (nextToLast == '5') {
                for (var j=last+2; j<mantissa.length; j++){
                    if(mantissa.charAt(j) != '0'){
                        roundUp = true;
                    }
                }
                if (lastChar % 2 == 1){
                    roundUp = true;
                }
            }
            var result = "";
            for (var i=last; i>=0; i--){
                var c = mantissa.charAt(i);
                if (roundUp){
                    var nextChar;
                    if (c == '9'){
                        nextChar = '0';
                    } else {
                        switch (c){
                            case '0': nextChar='1'; break;
                            case '1': nextChar='2'; break;
                            case '2': nextChar='3'; break;
                            case '3': nextChar='4'; break;
                            case '4': nextChar='5'; break;
                            case '5': nextChar='6'; break;
                            case '6': nextChar='7'; break;
                            case '7': nextChar='8'; break;
                            case '8': nextChar='9'; break;
                        }
                        roundUp = false;
                    }
                    result = nextChar + result;
                } else {
                    result = c + result;
                }
            }
            if (roundUp){
                result = '1' + result;
            }
            return(result);
        }
    }


    var roundedNumber = this
    var precision = 3

    if (digit || digit == 0) {
        precision = digit
    }

    var result = '';
    if (+roundedNumber === 0) {
        result = 0
    } else {
        var display = displaySigFigs(roundedNumber, precision, -999, false);
        // 去掉trailing zero
        if (display.includes('.')) {
            var index = display.lastIndexOf('.');
            if (index === display.length - 1) {
                display = display.split('');
                display.splice(index, 1);
                display.forEach(function (item) { result += item })
            } else {
                result = display;
            }
        } else {
            result = display;
        }
    }

    return result;
}

/**
 * @description: 公共脚本
 * @author: LiuXinYing
 */

/**
 * @func 通过一个key对数组对象进行排序
 * @desc 2020-04-14
 * @param {array} arr - 被排序的数组
 * @param {string} key - 数组对象内的key，根据此key进行排序
 */
function sortArrObjBySingleKey(arr, key) {
    // 是数组才能执行
    if (Array.isArray(arr) && key && typeof key == 'string') {
        arr.sort(function (a, b) {
            var valA = a[key] + '' // 必须要转成字符串
            var valB = b[key] + '' // 必须要转成字符串
            return valA.localeCompare(valB)
        })
    }
}

/**
 * @func 通过一个key对数组进行排序
 * @desc 2020-05-27
 * @param {array} arr - 被排序的数组
 */
function sortArrByLocaleCompare(arr) {
    // 是数组才能执行，仅支持字符串和数值排序
    if (Array.isArray(arr) && arr.every(function (d) { return ['number', 'string'].indexOf(typeof d)})) {
        arr.sort(function (a, b) {
            return a.localeCompare(b)
        })
    }
}

/**
 * @func 报告方法 - 根据档案id获取档案数据
 * @desc 2020-04-14
 * @param {string} id - 档案id
 */
function getRecordDataById(id) {
    var helper = get("labscareHelper");

    if (id) {
        var obj = helper.getCase(id)
        return obj
    }

    return null
}

/**
 * @func 报告方法 - 根据档案name获取档案数据
 * @desc 2020-04-14
 * @param {string} name - 档案name
 */
function getRecordDataByName(name) {
    var helper = get("labscareHelper");

    if (name) {
        var obj = helper.getCaseByName(name)
        return obj
    }

    return null
}

/**
 * @func 报告方法 - 根据档案id获取二级档案数据
 * @desc 2020-04-14
 * @param {string} id - 档案id
 */
function getSubRecordDataById(id) {
    var helper = get("labscareHelper");

    if (id) {
        var obj = helper.getSubCases(id)
        return obj
    }

    return null
}

/**
 * @func 合并对象（浅拷贝）（仅拷贝第一层）
 * @desc 2020-04-14
 * @param {object} 可传入一到多个对象，如果对象全部放在不定长度的数组中，调用时使用mergeObject.apply(null, arr)
 */
function mergeObject() {
    var mergeObj = {}
    for (var i = 0; i < arguments.length; i++) {
        if (typeof arguments[i] === 'object') {
            for (var o in arguments[i]) {
                mergeObj[o] = arguments[i][o]
            }
        }
    }
    return mergeObj
}

/**
 * @func 合并数组（浅拷贝并去重）（仅拷贝第一层，去重也只支持基本数据格式）
 * @desc 2020-04-14
 * @param {array} 可传入一到多个数组，如果数组全部放在不定长度的数组中，调用时使用mergeArray.apply(null, arr)
 */
function mergeArray() {
    var mergeArr = []
    for (var i = 0; i < arguments.length; i++) {
        if (Array.isArray(arguments[i])) {
            for (var j = 0; j < arguments[i].length; j++) {
                if (mergeArr.indexOf(arguments[i][j]) == -1) {
                    mergeArr.push(arguments[i][j])
                }
            }
        }
    }
    return mergeArr
}

/**
 * @func 多个数组内有交集的数据（仅支持基本数据格式）
 * @desc 2020-04-14
 * @returns {array} 返回值为数组
 * @param {array} 待检查的数组，可传入一到多个数组，如果数组全部放在不定长度的数组中，调用时使用intersectionArray.apply(null, arr)
 */
function intersectionArray() {
    var a = arguments
    var aLen = a.length
    var countObj = {}
    var sameArr = []

    for (var i = 0; i < aLen; i++) {
        var arr = a[i]
        if (Array.isArray(arr)) {
            for (var j = 0; j < arr.length; j++) {
                var key = arr[j]
                if (!countObj[key]) {
                    countObj[key] = 1
                } else {
                    ++countObj[key]
                }
            }
        }
    }

    for (var k in countObj) {
        if (countObj[k] == aLen) {
            sameArr.push(k)
        }
    }

    return sameArr
}

/**
 * @func 多个数组内有交集的数据（只要有两个数组包含就返回）（仅支持基本数据格式）
 * @desc 2020-04-14
 * @returns {object} 返回值为对象，key是出现在多个数组内的次数，value是交集数据的数组
 * @param {array} 待检查的数组，可传入一到多个数组，如果数组全部放在不定长度的数组中，调用时使用intersectionArray.apply(null, arr)
 */
function intersectionAllArray() {
    var a = arguments
    var aLen = a.length
    var countObj = {}
    var sameObj = {}

    for (var i = 0; i < aLen; i++) {
        var arr = a[i]
        if (Array.isArray(arr)) {
            for (var j = 0; j < arr.length; j++) {
                var key = arr[j]
                if (!countObj[key]) {
                    countObj[key] = 1
                } else {
                    ++countObj[key]
                }
            }
        }
    }

    for (var k in countObj) {
        var countNum = countObj[k]
        if (countNum != 1) {
            if (!sameObj[countNum]) {
                sameObj[countNum] = []
            }
            sameObj[countNum].push(k)
        }
    }

    return sameObj
}

/**
 * @func 判断一个数组内的数据是否全部一致（仅支持比较基本数据格式）
 * @desc 2020-04-14
 * @returns {boolean} 布尔值，不同为true，相同为false
 * @param {array} arr 数组
 */
function isArrValDiff(arr) {
    var isDiff = false

    if (Array.isArray(arr)) {
        var comparedVal = arr[0]
        for (var i = 1; i < arr.length; i++) {
            // 这里必须要用三个!==
            if (arr[i] != comparedVal) {
                isDiff = true
                break;
            }
        }
        return isDiff
    }

    return '当前传入的数据不是数组'
}

/**
 * @func 空值(undefiend或null)转换为空字符串
 * @desc 2020-04-14
 * @returns {string} 空字符串
 * @param {array} arr 数组
 */
function emptyValTransformEmptyString(val) {
    if (!val && typeof val != 'number') {
        return ''
    }
    return val
}

/**
 * @func 科学计数法（改自梁师傅的函数）
 * @desc 2020-04-21
 * @returns {string} html字符串
 * @param {string} 数值和有效位数，有效位数可以不填，默认为2
 */
function scientificNotation2(n) {
    var d = arguments[1] || 2
    var number = typeof n === 'string' ? Number(n) : n
    var digit = typeof d === 'string' ? Number(d) : d

    if (isNaN(number)) {
        return number
    }

    var scientificStr = number.toExponentialBank(digit)
    var numIndex = scientificStr.indexOf('e')-1
    var powerIndex = scientificStr.indexOf('e')+1
    var numVal = scientificStr.substring(0,numIndex)
    var powerVal = scientificStr.substring(powerIndex)

    if(powerVal.indexOf('+') >= 0){
        powerVal = powerVal.substring(powerVal.indexOf('+')+1)
    }
    return numVal+'×10'+powerVal.sup()
}

/**
 * @func 银行家舍入法，参考toExponential的返回结果修约
 * @desc 2020-04-22
 * @returns {string} 修约后的数字字符串
 * @param {number} 需要修约的长度
 */
Number.prototype.toExponentialBank = function (l) {
    var num = this
    var str = num + ''
    var len = typeof l === 'number' ? l : 0
    var splitNumArr // 分割的数据
    var intNum // 整数部分
    var decNum // 小数部分
    var expVal // 指数
    var numVal // 数值

    if (isNaN(str)) {
        return 'NaN'
    }
    if (len < 0) {
        throw new Error(" toExponentialBank() argument must be between 0 and 100");
    }
    // 返回修约后的数值
    function fixedNum(n, d) {
        var s = n + ''
        var splitStr = s.split('') // 拆分字符串
        var dotIndex = s.indexOf('.')
        var decPart = s.split('.')
        var fixedNum = decPart[1].charAt(d) // 被修约的数
        var fixedIndex = decPart[0].length + d + 1 // 加上小数点占一位
        var beforeFixedIndex = s[fixedIndex - 1] == '.' ? fixedIndex - 2 : fixedIndex - 1
        var beforeFixedNum = +s[beforeFixedIndex]
        var previousTwoFixedIndex = s[beforeFixedIndex - 1] == '.' ? beforeFixedIndex - 2 : beforeFixedIndex - 1
        var previousTwoFixedNum = +s[previousTwoFixedIndex]
        var afterFixedIndex = fixedIndex + 1
        var afterFixedNum = +s[afterFixedIndex]
        var carryNum

        if (fixedNum >= 6) {
            carryNum = beforeFixedNum + 1
            // 进位的值如果刚好是10
            if (carryNum === 10 && previousTwoFixedIndex !== -1) {
                splitStr[beforeFixedIndex] = 0
                splitStr[previousTwoFixedIndex] = previousTwoFixedNum + 1
            } else {
                splitStr[beforeFixedIndex] = carryNum
            }
            splitStr.splice(fixedIndex)
        } else if (fixedNum <= 4) {
            splitStr.splice(fixedIndex)
        } else { // 5的情况比较复杂
            var isOdd = !!(beforeFixedNum % 2) // 前一位数是否是奇数

            // afterFixedNum: 被修约数值后面值，存在的时候，直接进一位
            // isOdd: 被修约数值后面值，不存在的时候，根据前面值判断
            if (afterFixedNum || isOdd) {
                carryNum = beforeFixedNum + 1
                // 进位的值如果刚好是10
                if (carryNum === 10 && previousTwoFixedIndex !== -1) {
                    splitStr[beforeFixedIndex] = 0
                    splitStr[previousTwoFixedIndex] = previousTwoFixedNum + 1
                } else {
                    splitStr[beforeFixedIndex] = carryNum
                }
            }
            splitStr.splice(fixedIndex)
        }
        // 最后一位如果是.则去掉
        if (splitStr[splitStr.length - 1] === '.') {
            splitStr.pop()
        }

        return splitStr.join('')
    }
    // 返回小数部分字符串长度
    function decPartLen(n) {
        var s = n + ''
        var splitArr = s.split('.')
        var decStr = splitArr[1]

        return decStr ? decStr.length : 0
    }

    splitNumArr = str.split('.')
    intNum = splitNumArr[0]
    decNum = splitNumArr[1]

    // 先转换成指数的格式
    if (num >= 1) {
        var intLen = intNum.length
        expVal = intLen - 1 // 数值长度 - 1
        numVal = num / Math.pow(10, expVal)
    } else {
        var reg = /0+/ // 正则匹配多个0
        var subStr
        var matchData
        var digit

        splitNumArr = str.split('.')
        subStr = splitNumArr[1] // 取小数点之后的字符

        if (subStr) {
            matchData = reg.exec(subStr) // 匹配到0
            digit = (matchData && matchData.length && matchData[0].length) + 1  // 根据匹配得到的位数
            expVal = -digit
            numVal = num * Math.pow(10, digit)
        } else {
            expVal = 0
            numVal = num
        }
    }

    // 修约
    var decLen = decPartLen(numVal)

    if (decLen < len) { // 不足就补0
        // 没有小数部分就加上.
        if (decLen === 0) {
            numVal += '.' // 先加小数点
        }
        for (var i = 0; i < len - decLen; i++) {
            numVal += '0'
        }
    } else if (decLen > len) { // 超过就修约
        numVal = fixedNum(numVal, len)
    }

    // 判断一下修约完成后，是否出现9进10的情况
    if (+numVal === 10) {
        numVal = numVal / 10
        expVal += 1

        // 出现之后，有可能出现需要补零的情况
        decLen = decPartLen(numVal)
        if (decLen < len) { // 不足就补0
            numVal += '.' // 先加小数点
            // 补零
            for (var i = 0; i < len - decLen; i++) {
                numVal += '0'
            }
        }
    }

    // 给指数加上符号
    expVal = expVal >= 0 ? '+' + expVal : '' + expVal

    return numVal+'e'+expVal
}

/**
 * @func 保留几位小数位数，银行家舍入法，labscare插件代码
 * @desc 2020-04-22
 * @returns {string | number} 修约后的数字字符串，或原数据（原数据格式）
 * @param {number} 保留几位，需要修约的长度
 */
Number.prototype.toFixedBank = function (l) {
    function isEven(d) {
        return d%2===0;
    }

    function toBank(num, len) {
        if(num < 0) {
            return -toBank(-num, len);
        }

        const strNum = (num+'').replace(/0+$/, "");
        var decimalIndex = strNum.indexOf(".");

        if(decimalIndex < 0) {
            return num;
        }

        var intPart = strNum.slice(0, decimalIndex);
        if(intPart.length == 0) {
            intPart = 0;
        }
        var fractPart = strNum.slice(decimalIndex + 1) // extract fractional part
        if(fractPart.length < len) {
            return num;
        }
        var followingDig = parseInt(fractPart[len], 10);
        if(followingDig < 5) {
            // rounding not required
            var newFractPart = fractPart.slice(0, len);
            return parseFloat('' + intPart + '.' + newFractPart);
        }
        if(followingDig === 5) {
            var newFractPart = fractPart.slice(0, len + 1);
            if(parseInt(fractPart.slice(len + 1), 10) > 0) {
                fractPart = newFractPart + '9';
            } else {
                fractPart = newFractPart;
            }
        }
        var nextDig = parseInt(fractPart[fractPart.length-1], 10);
        var carriedOver = 0;
        for(var ptr = fractPart.length-1; ptr >= len; ptr--) {
            var dig = parseInt(fractPart[ptr-1], 10) + carriedOver;
            if(nextDig > 5 ||(nextDig == 5 && !isEven(dig))) {
                ++dig;
            }
            if(dig > 9) {
                dig -= 10;
                carriedOver = 1;
            } else {
                carriedOver = 0;
            }
            nextDig = dig;
        }
        var newFractPart = "";
        for(var ptr = len-2; ptr >= 0; ptr--) {
            var d = parseInt(fractPart[ptr], 10) + carriedOver;
            if(d > 9) {
                d -= 10;
                carriedOver = 1;
            } else {
                carriedOver = 0;
            }
            newFractPart = '' + d + newFractPart
        }
        intPart = parseInt(intPart, 10) + carriedOver;
        return parseFloat('' + intPart + '.' + newFractPart + nextDig);
    }


    var num = this
    var len = 2
    if (l) {
        len = l
    } else if (l === 0) {
        return num.toFixedIntBank(0)
    }
    if(isNaN(num)) {
        return 'NaN'
    }

    return toBank(num, len).toFixed(len)
};

/**
 * @func 修约变成整数，银行家舍入法，改进toFixedBank代码
 * @desc 2020-04-22
 * @returns {string | number} 只接受 0 或 '0'
 * @param {number} 保留几位，需要修约的长度
 */
Number.prototype.toFixedIntBank = function(l) {
    var fixedLen = (typeof l === 'number' ?  l : Number(l)) + 1 // 按传入的长度+1
    if (!isNaN(fixedLen) && fixedLen === 1) {
        var multi = fixedLen * 10 // 计算需要乘除的10的倍数
        var fixedNum = this
        return (fixedNum / multi).toFixedBank(fixedLen) * multi + ''
    }
    return 'NaN'
}

/**
 * @func 根据排放速率的值，转换成对应格式的数据
 * @desc 2020-04-22
 * @returns {string} html字符串
 * @param {string | number} 排放速率数据
 */
function transferAverageEmissionFormat(n) {
    // 小于0.01或大于等于100，使用科学计数法
    if (n < 0.01 || n >= 100) {
        return scientificNotation(n)
    } else { // 中间的直接修约2位数
        return n.toFixedBank(2)
    }
}

/**
 * @func 计算平均排放量
 * @desc 2020-04-26
 * @returns {string | number} 数值或错误提示
 * @param {string | number} exhaust 排放量
 * @param {string | number} density 浓度
 */
function calcAverageEmission(exhaust, density) {
    var e = typeof exhaust === 'number' ? exhaust : Number(exhaust)
    var d = typeof density === 'number' ? density : Number(density)

    if (e && d) {
        return e * d / 1000000 // 排气量*浓度/1000000
    }
    return 0
}

/**
 * @func 判断传入数据是否是对象，并获取对应字符串
 * @desc 2020-04-27
 * @returns {string} 字符串
 * @param {object} obj 数据
 * @param {string | number} key 数据内对应的key
 */
function judgeObjectGetString(obj, key) {
    // 加上''，转换为js字符串
    return obj && isJSONObject(obj) && (obj.get(key) + '') || ''
}

/**
 * @func 判断传入数据是否是对象，并获取对应数字
 * @desc 2020-04-27
 * @returns {number} 数字
 * @param {object} obj 数据
 * @param {string | number} key 数据内对应的key
 */
function judgeObjectGetNumber(obj, key) {
    // 数字，保持原内容
    return obj && isJSONObject(obj) && obj.get(key) || 0
}

/**
 * @func 判断传入数据是否是对象，并获取对应数组
 * @desc 2020-04-27
 * @returns {array} 数组
 * @param {object} obj 数据
 * @param {string | number} key 数据内对应的key
 */
function judgeObjectGetArray(obj, key) {
    // 数组，保持原内容
    return obj && isJSONObject(obj) && obj.get(key) || new ArrayList()
}

// 日期格式化 LiuXinYing
function formatDateCN(dateStr) {
    return format(dateStr + '', 'yyyy年MM月dd日')
}
function formatDatePoint(dateStr) {
    return format(dateStr + '', 'yyyy.MM.dd')
}


// *数值的正则匹配*
/******* 注意：这里的返回值，全部都是数组，建议取值时先判断数组是否为空，不为空则取索引值第一位 ********/
// 把数值全部匹配回来
function matchAllNumber(str) {
    var reg = /(\d+(\.)?(\d*))/g
    return ['string', 'number'].indexOf(typeof str) !== 1 ? (String(str).match(reg) || []) : []
}
// 移除数值的前面的0
function removeFrontZero(str) {
    var floatReg = /[^0]+|0\.\d+/g
    var intReg = /[^0\.]+\d*[^\.]/g     // 这个整形还是有一点问题，会匹配到小数部分的数值
    // 测试数据
    // 0000011.333
    // 000.11
    // 0022300

    return ['string', 'number'].indexOf(typeof str) !== 1 ? (String(str).match(floatReg) || String(str).match(intReg) || []) : []
}
// 移除数值的后面的0
function removeBehindZero(str) {
    var reg = /\d+(\.\d+[^0]+){0,1}(\.0){0,1}/g
    // 测试数据
    // 00002300.40034000
    // 23243000

    return ['string', 'number'].indexOf(typeof str) !== 1 ? (String(str).match(reg) || []) : []
}
// 两侧的0都移除，并且当小数点后只有0时，保留一位0的小数
function removeBothZero(str) {
    var reg = /[^0]+\d+(\.\d+[^0]+){0,1}(\.0){0,1}/g    // 或用不了，先这样写吧
    // 测试数据
    // 00002300.40034000
    // 02300.000

    return ['string', 'number'].indexOf(typeof str) !== 1 ? (String(str).match(reg) || []) : []
}

// 合并去重简单数据
function removeSameSimpleData(arr) {
    var newArr = []

    for(var i = 0; i < arr.length; i++) {
        if (newArr.indexOf(arr[i]) === -1) {
            newArr.push(arr[i])
        }
    }
    return newArr.length ? newArr : arr
}

// todo 未完成 合并去重简单数据，对象数据会直接返回(有个小问题，数组内的undefined值会被去掉)
function filterSimpleData() {
    // 可以传入多个参数
    for (var i = 0; i < arguments.length; i++) {
        var filterArr = arguments[i]
        // 数据格式正确才处理
        if (Array.isArray(filterArr)) {
            // 先把多余的删除掉，变成稀疏数组
            filterArr.forEach(function(data, index) {
                if (typeof data !== 'object' ) {
                    var findIndex = -1  // 这个值每次forEach都重置
                    while(findIndex !== index) {
                        findIndex > -1 ? delete filterArr[findIndex] : '' // 大于-1就执行，不大于就不执行
                        findIndex = filterArr.lastIndexOf(data)   // 倒着找，找到就在下一次while中删掉
                    }
                }
            })
            // 再对稀释数组进行压缩
            // todo 还未完成压缩
        }
    }
}

// 过滤得到，可以用于计算的数组，注意，仅做过滤，不进行数据格式的转换
function filterCalcArr(arr) {
    return arr.filter(function(data) {
        // 过滤掉除了字符串和数字的其他格式，以及过滤掉空字符串，并且要求当前数据转换成数值是有值的
        return ['string', 'number'].indexOf(typeof data) !== -1 && data !== '' && !isNaN(Number(data))
    })
}

// 在数组中查找一个数值的小数位数（这个函数不要随便修改，其他函数有使用）
function findDigitsFromArr(arr) {
    var filterArr = filterCalcArr(arr)  // 得到可计算的数组
    // 先找有小数点的数据（先转成数字再转换成字符串，以防万一，经常有数据抓取的数据进入脚本）
    var floatNumList = filterArr.length ? filterArr.filter(function(data) { return String(Number(data)).indexOf('.') > -1 }) : []
    // 小数点的位置
    var pointLenList = floatNumList.map(function(num) {
        var index = String(num).indexOf('.')
        return (String(num).slice(index + 1)).length
    })
    // 得到需要的小数位数
    var d

    if (pointLenList.length) {
        d = pointLenList.length === 1 ? pointLenList[0] : pointLenList.reduce(function(a, b) {
            return Math.max(a, b)
        })
    }

    return d || 0
}

// 在数组中查找有效位数
function findMaxDigitsFromArr(arr) {
    var filterArr = filterCalcArr(arr)  // 得到可计算的数组
    // 得到需要的总位数
    if (filterArr.length) {
        if (filterArr.length === 1) {
            return (String(filterArr[0]).replace('.', '')).length || 0
        } else {
            return String(filterArr.reduce(function(a, b) {
                const aStr = String(a).replace('.', '')
                const bStr = String(b).replace('.', '')
                return Math.max(Number(aStr), Number(bStr))
            })).length || 0
        }
    } else {
        return 0
    }
}

function getPrecisionAverage(arr, digits) {
    var data = calcAverageVal(arr, true, digits)
    var d = findMaxDigitsFromArr(arr)
    var a = data.a

    // 返回平均数（有效位数）
    return typeof a === 'number' ? (d ? a.toPrecisionBank(d) : a) : ''
}

function getFixedAverage(arr, digits) {
    var data = calcAverageVal(arr, true, digits)
    var d = data.d
    var a = data.a
    // 返回平均数（四舍六入五留双）
    return typeof a === 'number' ? a.toFixedBank(d) : ''
}

/**
 * @func 计算数组平均值（会去掉不符合计算要求的数据）
 * @desc 2020-07-18
 * @returns {Object | number} 有计算的结果值时返回数字，否则返回字符串
 * @param {Array} arr 需要被计算平均的数组
 * @param {boolean=} returnDigits （可选）是否需要返回小数位数
 * @param {string | number=} digits （可选）传入的保留小数位数
 */
function calcAverageVal(arr, returnDigits, digits) {
    var filterArr = filterCalcArr(arr)  // 得到可计算的数组
    var d
    // 如果传入的小数位数，不是字符串也不是数字，或传入的digits是NaN，或有小数位数时
    if (['string', 'number'].indexOf(typeof digits) === -1 || isNaN(Number(digits)) || String(digits).indexOf('.') > -1) {
        // 取数组内的小数位数
        d = findDigitsFromArr(filterArr) // 通过代码在数组内找到的小数位数
    } else {
        // 使用传入的小数位数
        d = Number(digits)
    }
    // 先把数组内的所有值转换为整数
    var intArr = filterArr.length ? filterArr.map(function(n) { return floatMultipleTransferInt(n, d) }) : []
    // 求过滤后数组的平均
    var intAver = intArr.length ? intArr.reduce(function(a, b) {return (+a) + (+b)}) / intArr.length : ''
    // 最后再转回浮点数
    var aver = intDivisionTransferFloat(intAver, d)

    return returnDigits ? {
        a: aver,
        d: d
    } : aver
}

/**
 * @func 浮点数通过乘法转换为整数
 * @desc 2020-09-16
 * @returns {number | string} 数据在正确的情况下，返回整数，否则返回其本身的内容
 * @param {number | string} n 需要转换的浮点数
 * @param {number | string} d 需要乘上的小数位数（这里一定要传对，否则转换不一定成功）
 */
function floatMultipleTransferInt(n, d) {
    return n && d && !isNaN(Number(n)) && !isNaN(Number(d)) ? Math.pow(10, d) * n : n
}
/**
 * @func 整数通过除法转换为浮点数
 * @desc 2020-09-16
 * @returns {number | string} 数据在正确的情况下，返回浮点数，否则返回其本身的内容
 * @param {number | string} n 需要转换的整数数
 * @param {number | string} d 需要乘上的小数位数（这里一定要传对，否则转换不一定成功）
 */
function intDivisionTransferFloat(n, d) {
    return n && d && !isNaN(Number(n)) && !isNaN(Number(d)) ? n / Math.pow(10, d) : n
}

/**
 * @description: 公共脚本
 * @author: LuPeng
 */

/**
 * @func 深度复制
 * @desc 2020-04-15
 * @returns {newObj} 返回新对象
 * @param {obj} 旧对象
 */
function deepClone(obj){
    var newObj=Array.isArray(obj)?[]:{}

    if(obj && typeof obj == "object"){
        for(var key in obj){
            if(obj.hasOwnProperty(key)){
                newObj[key]=(obj && typeof obj[key] == 'object') ? deepClone(obj[key]) : obj[key];
            }
        }
    }
    return newObj
}


/**
 * @description: 公共脚本
 * @author: YangSenJie
 */

/**
 * @func 判断数据为空，待补充其他情况
 * @desc 2020-04-22
 * @returns {boolean}
 */
function isEmpty(s){
    return s == null || (s + '').length == 0;
}

/**
 * @func 格式化空数据
 * @author: YangSenJie
 * @desc 2020-04-27
 * @returns {string}
 */
function formatEmptyData(s, placeholder){
    if (placeholder == undefined) {
        placeholder = '/'
    }
    if (isEmpty(s) && String(s) !== '0') {
        return placeholder
    } else {
        return s + ''
    }
}

/**
 * @description: 公共脚本
 * @author: YangSenJie
 */

/**
 * @func 根据 质控样的样品ID 获取其 质控样信息
 * @desc 2020-04-23
 * @param {string}
 */
function getSampleFkQualitysByQualityIds(id) {
    var helper = get("labscareHelper");
    if (id) {
        var obj = helper.getSampleFkQualitysByQualityIds(id)
        return obj
    }
    return null
}

/**
 * @description: 公共脚本
 * @author: MoShengYuan
 */

/**
 * @func 判断是否是JSON对象（从脚本内取出的对象数据）
 * @desc 2020-04-26
 * @param {string}
 */
function isJSONObject(value) {
    return Class.forName("com.alibaba.fastjson.JSONObject").isInstance(value);
}

/**
 * @func 判断是否是JSON数组（从脚本内取出的对象数据）
 * @desc 2020-04-26
 * @param {string}
 */
function isJSONArray(value) {
    return Class.forName("com.alibaba.fastjson.JSONArray").isInstance(value);
}

/**
 * @func 判断是否是UtilList数组（从脚本内取出的对象数据），用于关联档案的caseList和fkCases的判断
 * @desc 2020-12-09
 *
 */
function isUtilList(value) {
    return Class.forName("java.util.List").isInstance(value);
}

/**
 * @func 地图组件gps的格式转换
 * @desc 2020-12-01
 * @param {number | string} degree
 * @param {number | string} fixNum
 * @returns {string}
 */
function gpsTransfer(degree, fixNum) {
    if (isNaN(Number(degree))) {
        return ''
    }
    var num = Math.abs(degree)
    var int = Math.floor(num)
    var dec = num !== int ? num - int : 0
    var min = Math.floor(dec * 60)
    var sec = (dec * 60 - min) * 60

    return int + '°' + (min ? min + '\"' : '') + (sec ? sec.toFixed(Number(fixNum) || 0) + '\'' : '')
}

/**
 * 日期转年 LuPeng
 *
 * @param {string} dateStr
 */
function formatDateByYear(dateStr) {
    return format(dateStr + '', 'yyyy')
}

function formatDate(dateStr,coustomFormat) {
    var s = ''
    try{
        s = format(dateStr + '', coustomFormat)
    }catch(e){

    }
    return nonull(s)
}

// 取参数里面不为空那个
function nullIfElse() {
	for(var i=0;i<arguments.length;i++) {
		if(arguments[i]!=null) {
			return arguments[i];
		}
	}
	return null;
}

function nonull(val) {
    if(val==null) {
        return '';
    }
    return val+'';
}

/**
 * 时间范围 yyyy 年 MM 月 dd 日 至 MM 月 dd 日等
 * fromYear 文档专属方法，不属于js方法
 * @param {*} fromDate 
 * @param {*} toDate 
 */
function dateRangeYc(fromDate, toDate) {
    if(isEmpty(fromDate) && isEmpty(toDate)) {
        return '';
    }
    if(isEmpty(fromDate) || isEmpty(toDate)) {
        if(!isEmpty(fromDate)) {
            return format(fromDate, 'yyyy年MM月dd日');
        } else if(!isEmpty(toDate)) {
            return format(toDate, 'yyyy年MM月dd日');
        }
    }else if(fromDate == toDate){
         return format(fromDate, 'yyyy年MM月dd日');
    }
    var fromContent=format(fromDate, 'yyyy年MM月dd日');
    var toContent='';
    try{
        var fromYear=getYear(fromDate);
        var toYear=getYear(toDate);
        if(fromYear!=toYear) {
            toContent=format(toDate, 'yyyy年MM月dd日');
        } else {
            var fromMonth=getMonth(fromDate);
            var toMonth=getMonth(toDate);
            if(fromMonth!=toMonth) {
                toContent=format(toDate, 'MM月dd日');
            } else {
                toContent=format(toDate, 'dd日');
            }
        }
    }catch(e){

    }

    return fromContent + ' 至 ' + toContent;
}

//ysj 为取数据做一层封装
function setObjDataByTypeBatch(obj, data, source) {
    for (var i in obj) {
        setObjDataByType(obj[i], data, source, i)
    }
}
function setObjDataByType(type, data, source, key, label) {
    if (!label) {
        label = key
    }
    switch (type) {
        // 取回来一个数据，不做其他处理
        case 0:
            data[key] = source.get(label)
            break;
        // 取回来一个字符串，如果是空默认赋值''
        case 1:
            data[key] = formatEmptyData(source.get(label), '')
            break;
        // 取回来一个字符串，如果是空默认赋值'/'
        case 2:
            data[key] = formatEmptyData(source.get(label), '/')
            break;
    }
}

//生成多选框html
// checked 选到的字符串选项
// options 选项数组
function initCheckBox(checked,options,joinStr){

    var str = checked+""
    var outs = []
    var checks = options
    var de = '<span style="font:Wingdings;font-size:14px;">&#61551;</span>&nbsp;&nbsp;'
    var ok = '<span style="font:Wingdings;font-size:14px;">&#61694;</span>&nbsp;&nbsp;'
    for(var i=0;i<checks.length;i++){
    var check = checks[i]
    var checkStr = de+check
    if(str==check){
        checkStr = ok+check
    }
    outs.push(checkStr)
    }
    if(joinStr){
        return outs.join(joinStr)
    }
    return outs.join( '&nbsp;&nbsp;')
}


//根据出生日期 得到周岁年龄 
function jsGetAge(strBirthday)
{      
    var returnAge;
    var strBirthdayArr=strBirthday.split("-");
    var birthYear = strBirthdayArr[0];
    var birthMonth = strBirthdayArr[1];
    var birthDay = strBirthdayArr[2];
   
    var d = new Date();
    var nowYear = d.getYear();
    var nowMonth = d.getMonth() + 1;
    var nowDay = d.getDate();
   
    if(nowYear == birthYear)
    {
        returnAge = 0;//同年 则为0岁
    }
    else
    {
        var ageDiff = nowYear - birthYear ; //年之差
        if(ageDiff > 0)
        {
            if(nowMonth == birthMonth)
            {
                var dayDiff = nowDay - birthDay;//日之差
                if(dayDiff < 0)
                {
                    returnAge = ageDiff - 1;
                }
                else
                {
                    returnAge = ageDiff ;
                }
            }
            else
            {
                var monthDiff = nowMonth - birthMonth;//月之差
                if(monthDiff < 0)
                {
                    returnAge = ageDiff - 1;
                }
                else
                {
                    returnAge = ageDiff ;
                }
            }
        }
        else
        {
            returnAge = -1;//返回-1 表示出生日期输入错误 晚于今天
        }
    }
   
    return returnAge;//返回周岁年龄
   
}
function getCheckBox(val){
	if(val){
		return '<span style="font:Wingdings;font-size: 14pt">&#61694;</span>'
	}else {
		return '<span style="font:Wingdings;font-size: 14pt">&#61551;</span>'
	}
}
//获取签名的Url
function getSignUrl(obj){
    if(obj && Array.isArray(obj)){
        return headerUrl + obj[0].val
    }
    if (obj && typeof obj == "object") {
        return obj.val
    }
    if (obj && typeof obj == "string") {
        return obj
    }
    return ''
}
set('getCheckBox',getCheckBox)
set('getRadioVal', getRadioVal)
set('initCheckBox', initCheckBox)
set('headerUrl',headerUrl)
set('getSignUrl',getSignUrl)