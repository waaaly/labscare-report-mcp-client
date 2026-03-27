# 真实案例中反复出现的代码模式

以下模式全部来自已提炼的真实脚本，不是臆测。

## 目录

- `tools.js` 快捷函数模式
- `partData + gaugingData + ObjAssign + getValue`
- 主过滤方式
- 主分组方式
- 多数组单对象写法
- 关联对象深入路径
- 签名图、复选框、日期模板模式
- 不要过度规范化

## 1. `tools.js` 快捷函数模式

来源：

- `033水样采样记录表`

这个样本没有自己写流程定位函数，而是直接用了 `tools.js` 里的快捷能力：

```javascript
var form = getForm(procedures);
var s1 = getSignUrl(sample.t_sampleMan);
```

适用场景：

- 当前脚本家族已经有人这样写。
- 你希望快速拿 `form` 和签名 URL，不想重复展开流程 Map。

注意：

- 这是样本里“已证实存在”的工具函数，不代表每个客户环境都一定一致。
- 如果当前任务没有同类历史参考支持，不要盲目假定所有工具函数都存在。

## 2. `partData + gaugingData + ObjAssign + getValue` 骨架

来源：

- `099中子辐射剂量率测量结果处理表`
- `137流出物样品γ谱分析原始记录表`
- `X-γ辐射剂量率测量记录表`
- `原子吸收光谱测定水样中元素分析原始记录表`
- `氡析出率测量结果处理表`

这是当前样本里最稳定的一类骨架：

```javascript
function partData() {
    return {
        t_htName: '',
        t_wtName: '',
        t_TestMan: '',
        t_checkMan: ''
    }
}

function gaugingData() {
    return {
        caseName: '',
        factorName: '',
        t_mark: ''
    }
}

function ObjAssign(sample, gauging, schema) {
    if (!sample || !gauging) {
        return
    }
    var newObj = Object.assign({}, schema)
    for (var key in newObj) {
        newObj[key] = getValue(sample[key] || gauging[key], key) || newObj[key]
    }
    return newObj
}

function getValue(obj, key) {
    ...
}
```

它解决的是：

- 先定义一个“只保留模板需要字段”的骨架对象。
- 再把 `sample` / `gauging` / `form` 中同名字段拷进去。
- 最后得到一个扁平、适合模板直接绑定的对象。

补充理解：

- 这套模式不只是字段白名单，还常常连着一整套固定控制流一起出现，例如“先建 output 壳，再二次追加 `gaugingList`”。
- 因此当你确认当前任务属于这个家族时，优先跟随整套骨架，少做结构性重写。
- 特别要把“输出 key 白名单”和“来源优先级”分开看；同一个 `gaugingData()` 字段，未必只能从当前 `gauging` 取值。

## 3. `getValue` 的真实行为边界

上面这套骨架通常配这个 `getValue`：

```javascript
function getValue(obj, key) {
    var type = getType(obj)
    if (type === "Array") {
        var tempVal = [];
        for (var i = 0; i < obj.length; i++) {
            var ss = obj[i];
            if (ss && (ss.hasOwnProperty(key) || ss.hasOwnProperty("val"))) {
                var vv = getValue(ss[key] || ss, key);
                if (vv) {
                    tempVal.push(vv)
                }
            }
        }
        return tempVal.join("、")
    }
    if (type === "Object") {
        var val = obj['val']
        if (val && val.indexOf('/sign') != -1) {
            return ossImgUrl + val
        }
        return obj[key] || val
    }
    return obj
}
```

它的隐含语义是：

- 数组会被递归扁平化并用 `、` 连接。
- 下拉对象通常会被取 `.val`。
- 签名数组会被转成完整 URL。

所以它有一个很重要的使用边界：

- 如果模板需要的是“原始数组/原始关联对象”，不要用它把结构提前压扁。

典型反例：

- 模板内联 JS 还要访问 `t_shuMan[0].val`。
- 模板还要访问 `t_glQX.fkCases[0].t_qx`。

这时应保留原始对象结构，只对最终显示字段单独处理。

## 4. 三种主过滤方式

### 按样品模板 `tempId`

来源：

- `033`
- `092`
- `099`

```javascript
if (sample.tempId === '1143311212931801601') { ... }
```

适用：

- 同一项目里混着多种样品模板。
- 只需要其中一类样品参与当前报表。

### 按检测项目模板名 `gaugingTemplateName`

来源：

- `092`
- `137`
- `原子吸收`
- `氡析出率`
- `电感耦合`

```javascript
if (gauging.gaugingTemplateName === '137流出物样品γ谱分析原始记录表') { ... }
```

适用：

- 同一样品下有多个检测项目，只拿某一类分析记录。

### 按版本号 `t_version`

来源：

- `099`
- `X-γ`
- `监测报告（电磁）`

```javascript
if (showGaugingList.indexOf(g3.t_version) === -1) {
    return
}
```

适用：

- 同一个因子家族通过版本号区分报表模板。
- 但对 `监测报告（电磁）` 这类模板，不要只看 `t_version`；应与精确 `factorName` 成对使用：
  - `工频电场/工频磁场` 对 `003`
  - `环境噪声` 对 `022`
  - 如果只按关键词如“电磁”“噪声”模糊归类，容易把别的检测项误塞进 `gpdcList` / `hjzsList`

## 5. 三种主分组方式

### 按签名组合分组

来源：

- `033水样采样记录表`

```javascript
var findKey = s1 + s2 + s3 + s4
```

含义：

- 相同签名组合的多个样品合并成一份报告。

### 按现场字段分组

来源：

- `X-γ辐射剂量率测量记录表`

```javascript
var existingCommonData = outputData.find(function(data) {
    return data.t_changSuo === itm.t_changSuo;
});
```

含义：

- 相同测量场所的数据聚成一份报告。

### 每个样品一份

来源：

- `137流出物样品γ谱分析原始记录表 `

```javascript
dataCommon.sampleId = item.caseName;
```

含义：

- 先为每个样品建立一个输出壳，再把该样品对应的 gauging 逐条塞进去。

## 6. 单对象中挂多个明细数组

来源：

- `092α、β表面污染测量结果处理表`
- `电感耦合等离子体质谱法分析原始记录表`

常见写法：

```javascript
reports.arr1 = arr1.length ? arr1 : [{}]
reports.arr2 = arr2.length ? arr2 : [{}]
reports
```

适用：

- 模板里有多个 `<data>` 区域。
- 这些表共享同一份表头。

## 7. 关联档案 / 关联曲线对象的取值模式

来源：

- `原子吸收光谱测定水样中元素分析原始记录表`
- `电感耦合等离子体质谱法分析原始记录表`

真实样本说明了两个很关键的嵌套对象结构：

```javascript
var fkFirst = GaugingFirstData.t_glQX ? GaugingFirstData.t_glQX.fkCases[0] : ''
var t_qx = fkFirst.t_qx
```

```javascript
reports.t_dw = Object.prototype.toString.call(gauging.t_qx) === '[object Object]'
    ? gauging.t_qx.caseList[0] && gauging.t_qx.caseList[0].t_JZtab[0] && gauging.t_qx.caseList[0].t_JZtab[0].t_dw
    : ''
```

反推原则：

- 看到 `fkCases`、`caseList` 这种字段，就要意识到它不是普通下拉，而是“关联到另一份档案/曲线/仪器记录”。
- 这类字段通常需要单独深入取值，不能简单 `.val` 后结束。

## 8. 固定表格高度补空行

来源：

- `099`
- `原子吸收`
- `氡析出率`

常见写法：

```javascript
var len = 4;
var remainder = gaugingList.length % len;
if (remainder !== 0) {
    var fillCount = len - remainder;
    for (var i = 0; i < fillCount; i++) {
        gaugingList.push({});
    }
}
```

适用：

- 模板表格高度固定。
- 结果图显示最后一页也要补足空白行以对齐版式。

## 9. 排序与去重

来源：

- `033`
- `092`
- `099`
- `监测报告（电磁）`

真实样本里的常见动作：

- `sortArrObjBySingleKey(list, 'caseName')`
- `localeCompare` 按 `t_num` 排序
- `filter((n,i) => list.indexOf(n) == i)` 去重

这些动作一般不是业务核心，而是为了让结果图版式稳定、顺序符合人工习惯。

### `监测报告（电磁）` 的精确骨架

来源：

- `监测报告（电磁）`

这个家族虽然返回根只是 `formJs`，但明细和环境条件的构造规则比表面上更严格：

```javascript
e.sortNum = e.caseName.slice(-3);
if (['工频电场/工频磁场', '环境噪声'].indexOf(k.factorName) > -1 &&
    ['003', '022'].indexOf(k.t_version) > -1) {
    gaugingTableListAll.push(Object.assign(k, {
        t_dianweiM: e.t_dianweiM,
        sortNum: e.sortNum
    }));
}
sortArrObjBySingleKey(gaugingTableListAll, 'sortNum');
```

再往下不是直接把 `gaugingTableListAll` 原样塞给模板，而是拆成三层：

- `gpdcList`
  - 只收 `factorName === '工频电场/工频磁场' && t_version === '003'`
  - 并且还要求 `t_nameYQ`、`t_modeXH`、`t_numYQ` 都存在
- `hjzsList`
  - 只收 `factorName === '环境噪声' && t_version === '022'`
  - 同样要求仪器三字段齐全
- `jctjList2`
  - 先把候选行整理成 `jctjList1`
  - 工频类用 `t_jcDate` 兜成 `t_TestDate`
  - 再按 `t_TestDate + factorName` 分组
  - 最后把同组里的 `t_wendu`、`t_shidu` 去重排序后压成区间，例如 `20~22`

反推提示：

- 如果你只是“第一条工频 + 第一条噪声”各拿一行去喂 `jctjList2`，通常能把模板填满，但结构上仍然和真实家族不一致。
- 如果你把整份 `form` 合并进 `gpdcList` / `hjzsList` 每一行，模板多数时候也能跑，但那不是这个家族最近邻样本的真实形状。
- 这个家族的 `monitoringItemSubTitle` 也不是看“列表是否非空”这么宽松，而是看精确检测项是否出现，再输出：
  - `电磁环境，声环境`
  - `电磁环境`
  - `声环境`

## 10. 当前样本里出现过的签名/图片写法

### 模板直接拼 URL

来源：

- `092` 占位符说明
- `电感耦合` 占位符说明

```javascript
=headerUrl + t_shuMan[0].val
```

```javascript
=headerUrl + t_TestMan[0].val
```

### 脚本先把 URL 算好，模板只取字段

来源：

- `033`
- `099`
- `原子吸收`
- `氡析出率`

```javascript
t_checkMan: getSignUrl(sample.t_shr)
```

或：

```javascript
if (val && val.indexOf('/sign') != -1) {
    return ossImgUrl + val
}
```

### 模板内联 JS 再拼

来源：

- `监测报告（电磁）` 占位符说明

```javascript
//javascript
var str
if(t_wordMan && t_wordMan.length>0){
  str = headerUrl + t_wordMan[0].val
}
str
```

结论：

- 当前样本里至少存在三套并行的签名图片方案。
- 不要强行统一成一种“官方标准”。
- 应优先跟随最接近的已知参考或已有模板说明。

## 11. 当前样本里出现过的复选框 / 日期模板内联模式

来源：

- `原子吸收` 占位符说明
- `监测报告（电磁）` 占位符说明

复选框：

```javascript
//javascript
var listText = ['石墨炉原子吸收法','火焰原子吸收法']
var list = []
var val = t_clff ? t_clff : ''
listText.forEach(function(e) {
    var obj = getCheckBox(val == e) + e
    list.push(obj)
})
list.join("&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;")
```

日期：

```javascript
${t_wordManDate ? formatDateCN(t_wordManDate) : ''}
```

注意：

- 样本模板说明里明确使用了 `getCheckBox` / `formatDateCN`。
- 但样本脚本通常没有显式 `set()` 它们。
- 先按最接近的已知参考写，运行时报缺符号时再补导出。

## 12. 不要过度“规范化”

当前样本里一些写法看上去不够漂亮，但它们是真实能工作的：

- `var templateId = ''` 配合 `templateld = i`
- `procedure = procedures[processId]` 与 `.get()` 混用
- 有的脚本硬编码 `ossImgUrl`
- 有的脚本直接把 `sample`、`form`、`gauging` 塞进一个对象里

规则不是“把代码改得更教科书”，而是：

- 让新脚本与最接近的已知参考保持同一套语言和假设。
- 让模板、结果图和脚本三者互相对得上。
