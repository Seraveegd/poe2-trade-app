/// <reference lib="webworker" />

let cachedBasics: any = null;
let cachedStats: any = null;
let cachedWeaponTypes: any = null;
let processedStats: any = {};

function cleanKey(text: string): string {
    return text.replace(/[+\-%#\d\[\]\.]/g, '');
}

addEventListener('message', ({ data }) => {
    if (data.type === 'INIT') {
        cachedBasics = data.basics;
        cachedStats = data.stats;
        cachedWeaponTypes = data.weaponTypes;

        // 預先處理詞綴，建立乾淨的 key 與原始詞綴的對照表
        processedStats = {};
        if (cachedStats) {
            Object.keys(cachedStats).forEach(category => {
                processedStats[category] = {};
                const entries = cachedStats[category];
                if (entries) {
                    Object.keys(entries).forEach(originalKey => {
                        const cleaned = cleanKey(originalKey);
                        if (!processedStats[category][cleaned]) {
                            processedStats[category][cleaned] = [];
                        }
                        processedStats[category][cleaned].push({
                            originalKey: originalKey,
                            ids: entries[originalKey]
                        });
                    });
                }
            });
        }
        return;
    }

    if (data.type === 'ANALYZE') {
        const { text, config, uxSearchOptions } = data;
        const result = analyze(text, cachedBasics, config, uxSearchOptions);
        postMessage(result);
    }
});

//詞綴種類
const statTypes: any = [
    ['implicit', '固定'],
    ['rune', '增幅'],
    ['enchant', '附魔'],
    ['desecrated', '褻瀆'],
    ['fractured', '破裂'],
    ['sanctum', '聖所'],
    ['crafted', '工藝'],
    ['skill', '技能'],
    ['explicit', '隨機']
];

//有減少的詞綴部分字串
const reduceStrs: any = [
    '充能使用',
    // '藥劑充能',
    '對你的擊中',
    '你身上的點燃持續時間',
    '你身上的冰緩持續時間',
    '你身上的冰凍持續時間',
    '你身上的感電持續時間',
    '身上元素異常狀態時間',
    '技能魔力消耗',
    '感電效果',
    '冰緩效果',
    '點燃效果',
    '你身上的詛咒效果',
    // '減益效果緩速程度',
    '技能保留的精魂',
    '不死召喚物',
    '每使用一次閃避翻滾',
    '敵人暈眩門檻',
    '怪物遭暴擊時'
]

//有更少的詞綴部分字串
const moreStrs: any = [
    '怪物身上的詛咒'
]

//元素抗性偽屬性
const pseudoElementalResistance: any = [
    'implicit.stat_1671376347', //閃電(固定)
    'implicit.stat_3372524247', //火焰(固定)
    'implicit.stat_4220027924', //冰冷(固定)
    'implicit.stat_2901986750', //全部(固定)
    'explicit.stat_3372524247', //火焰(隨機)
    'explicit.stat_4220027924', //冰冷(隨機)
    'explicit.stat_1671376347', //閃電(隨機)
    'explicit.stat_2901986750', //全部(隨機),
    'fractured.stat_1671376347', //閃電(破裂)
    'fractured.stat_3372524247', //火焰(破裂)
    'fractured.stat_4220027924', //冰冷(破裂)
    'fractured.stat_2901986750', //全部(破裂)
    'rune.stat_1671376347', //閃電(符文)
    'rune.stat_3372524247', //火焰(符文)
    'rune.stat_4220027924', //冰冷(符文)
    'rune.stat_2901986750', //全部(符文)
    'desecrated.stat_3465022881', //閃電+混(褻瀆)
    'desecrated.stat_378817135', //火焰+混(褻瀆)
    'desecrated.stat_3393628375', //冰冷+混(褻瀆)
    'desecrated.stat_1671376347', //閃電(褻瀆)
    'desecrated.stat_3372524247', //火焰(褻瀆)
    'desecrated.stat_4220027924', //冰冷(褻瀆)
    'desecrated.stat_2901986750', //全部(褻瀆)
    'sanctum.stat_3128852541' //全部(聖所)
];

function magicPositionGet(text: string) {
    return text.lastIndexOf('之') > -1 ? text.lastIndexOf('之') : text.lastIndexOf('的');
}

function analyze(text: string, basics: any, config: any, uxSearchOptions_initial: any) {
    const { newLine, filters_def, item_initial, searchOptions_initial, ui_initial } = config;
    const weaponTypes = cachedWeaponTypes;

    let item = JSON.parse(JSON.stringify(item_initial));
    let filters = { searchJson: JSON.parse(JSON.stringify(filters_def)) };
    let searchOptions = JSON.parse(JSON.stringify(searchOptions_initial));
    let uxSearchOptions = JSON.parse(JSON.stringify(uxSearchOptions_initial));
    let ui = JSON.parse(JSON.stringify(ui_initial));

    let itemArray = text.split(newLine);
    itemArray = deleteUnUseString(itemArray);

    console.log(itemArray);

    let start = itemArray[0].indexOf("物品種類") === -1 ? 0 : 1;

    //物品稀有度
    let posRarity = itemArray[start].indexOf(': ');
    let Rarity = itemArray[start].substring(posRarity + 2).trim();

    //物品名稱 - name
    let searchName = itemArray[start + 1];
    item.name = itemArray[start + 2] === "--------" ? `物品名稱 <br>『${itemArray[start + 1]}』` : `物品名稱 <br>『${itemArray[start + 1]} ${itemArray[start + 2]}』`;
    //物品基底 - type
    let itemBasic = itemArray[start + 2] === "--------" ? itemArray[start + 1] : itemArray[start + 2];

    // 物品檢查與基底判定
    basics.categorizedItems.some((element: any) => {
        const i = itemBasic.indexOf(element.type);
        let b = itemBasic.split(' ');

        if (i > -1 && (b.length > 1 ? (b[0].length > i ? b[0].length === element.type.length : b[1].length === element.type.length) : Rarity === '魔法' ? (magicPositionGet(itemBasic) + 1) === i : i === 0 && itemBasic.length === (i + element.type.length))) {
            itemBasic = element.type;
            item.basic = element.type;

            searchOptions.itemCategory.option.length = 0;
            uxSearchOptions.base.rarity = 'nonunique';

            item.type = element.option;
            searchOptions.itemBasic.text = element.text ?? element.type;

            if (text.indexOf('物品等級: ') > -1) {
                let levelPos = text.substring(text.indexOf('物品等級: ') + 5);
                let levelValue = parseInt(levelPos.substring(0, levelPos.indexOf(newLine)).trim(), 10);
                uxSearchOptions.base.ilvl.min = levelValue >= 86 ? 86 : levelValue;
            }

            searchOptions.itemCategory.option.push({ label: element.name, prop: element.option });
            uxSearchOptions.base.category = element.option;

            if (element.weapon) {
                searchOptions.itemCategory.option.push({ label: weaponTypes[element.weapon], prop: element.weapon });
            }
            if (element.option.indexOf('map') > -1) searchOptions.itemBasic.isSearch = true;

            if (Rarity !== '傳奇') {
                item.category = 'item';
            }
            return true;
        }
        return false;
    });

    // 詞綴分析主邏輯
    if (Rarity === "傳奇") {
        item.category = 'unique';
        uxSearchOptions.base.rarity = text.indexOf('傳奇 (貼模)') > -1 ? 'uniquefoil' : 'unique';

        searchOptions.itemSocket.min = getSocketNumber(text, newLine);
        searchOptions.itemSocket.max = getSocketNumber(text, newLine);
        // uxSearchOptions.equipment.rune_sockets.min = getSocketNumber(text, newLine);
        // uxSearchOptions.equipment.rune_sockets.max = getSocketNumber(text, newLine);

        searchOptions.itemBasic.isSearch = true;
        if (text.indexOf('未鑑定') === -1) { // 已鑑定傳奇  
            searchOptions.itemBasic.text = searchName + ' ' + itemBasic;
            itemStatsAnalysis(itemArray, 1, item, ui);
        } else { // 未鑑定傳奇(但會搜到相同基底)
            searchOptions.itemBasic.text = (searchName.indexOf('精良的') > -1) ? searchName.substring(4) : searchName;
        }
    } else if (Rarity === "寶石") {//之後檢視
        item.category = 'gem';
        basics.gem.chosenG = searchName;
        basics.gem.isSearch = true;

        if (text.indexOf('輔助寶石') === -1) {
            let levelPos = text.substring(text.indexOf('等級: ') + 4);
            let levelPosEnd = levelPos.indexOf(newLine);
            uxSearchOptions.misc.gem_level.min = parseInt(levelPos.substring(0, levelPosEnd).replace(/[+-]^\D+/g, ''), 10);

            let minQuality = 0;
            if (text.indexOf('品質: +') > -1) {
                let quaPos = text.substring(text.indexOf('品質: +') + 5); // 品質截斷字串 (包含'品質: +'前的字串全截斷)
                let quaPosEnd = quaPos.indexOf('% (augmented)'); // 品質定位點
                minQuality = parseInt(quaPos.substring(0, quaPosEnd).trim(), 10);

                uxSearchOptions.base.quality.min = minQuality;
            }

            uxSearchOptions.misc.gem_sockets.min = getSocketNumber(text, newLine);
        }
    } else if (Rarity === "通貨" || Rarity === "通貨不足") {
        item.category = 'currency';

        if (searchName.indexOf('寶石') > -1) {
            let levelPos = text.substring(text.indexOf('等級: ') + 4);
            let levelPosEnd = levelPos.indexOf(newLine);
            let level = parseInt(levelPos.substring(0, levelPosEnd).replace(/[+-]^\D+/g, ''), 10);
            uxSearchOptions.base.ilvl.min = level;
            uxSearchOptions.base.ilvl.max = level;

            item.name += ("<br>等級: " + level);
        }

        if (searchName.indexOf("巨靈之幣") > -1 || searchName.indexOf('最後通牒雕刻') > -1) {
            let levelPos = text.substring(text.indexOf('區域等級: ') + 6);
            let levelPosEnd = levelPos.indexOf(newLine);
            let level = parseInt(levelPos.substring(0, levelPosEnd).replace(/[+-]^\D+/g, ''), 10);
            uxSearchOptions.base.ilvl.min = level;

            let maxLevel = 0;
            switch (true) {
                case level >= 75:
                    maxLevel = 82;
                    break;
                case level >= 60 && level < 75:
                    maxLevel = 74;
                    break;
                case level >= 45 && level < 60:
                    maxLevel = 59;
                    break;
                case level < 45:
                    maxLevel = 44;
                    break;
                default:
                    break;
            }
            uxSearchOptions.base.ilvl.max = maxLevel;

            item.name += ("<br>區域等級: " + level);
        }

        Object.assign(filters.searchJson.query, { type: searchName });
        uxSearchOptions.base.rarity = "";
    } else if (item.category === 'item') {
        searchOptions.itemSocket.min = getSocketNumber(text, newLine);
        searchOptions.itemSocket.max = getSocketNumber(text, newLine);
        // uxSearchOptions.equipment.rune_sockets.min = getSocketNumber(text, newLine);
        // uxSearchOptions.equipment.rune_sockets.max = getSocketNumber(text, newLine);
        itemStatsAnalysis(itemArray, 0, item, ui);
        if (item.type.indexOf('armour') > -1) itemDefencesAnalysis(itemArray, item);

        //探險日誌地區等級
        if (item.type.indexOf('logbook') > -1) {
            let levelPos = item.substring(item.indexOf('地區等級: ') + 6);
            let levelPosEnd = levelPos.indexOf(newLine);
            let level = parseInt(levelPos.substring(0, levelPosEnd).replace(/[+-]^\D+/g, ''), 10);
            uxSearchOptions.misc.area_level.min = level;
            uxSearchOptions.misc.area_level.max = level;

            item.name += ("<br>地區等級: " + level);
        }
    }

    // 地圖處理
    if (text.indexOf('物品種類: 換界石') > -1) {
        item.category = 'map';

        uxSearchOptions.base.rarity = 'nonunique';

        let mapPos: any = text.indexOf('換界石階級:') > -1 ? text.substring(text.indexOf('換界石階級:') + 6) : 0;
        if (mapPos) {
            let mapTier = parseInt(mapPos.substring(0, mapPos.indexOf(newLine)).trim(), 10);
            uxSearchOptions.maps.map_tier.min = mapTier;
            uxSearchOptions.maps.map_tier.max = mapTier;
        }
        if (Rarity !== '中') itemStatsAnalysis(itemArray, 0, item, ui);
    }

    // 僅回傳 basics 中需要同步的狀態欄位
    const basicsUpdate = {
        gem: {
            chosenG: basics.gem.chosenG,
            isSearch: basics.gem.isSearch
        }
    };

    return { item, filters, searchOptions, uxSearchOptions, ui, basicsUpdate };
}

function itemStatsAnalysis(itemArray: any, rarityFlag: any, item: any, ui: any) {
    ui.collapse.stats = rarityFlag ? true : false;

    //刪除地圖描述
    if (item.type.indexOf('map') > -1) {
        itemArray.splice(-1, 2);
    }

    let tempStat: any[] = [];
    let itemStatStart = 0; // 物品隨機詞綴初始位置
    let itemStatEnd = itemArray.length - 1; // 物品隨機詞綴結束位置
    let itemDisplayStats: any[] = []; // 該物品顯示的詞綴陣列
    let itemDisplayLevel: any = []; // 該物品顯示的詞綴等級陣列

    itemArray.forEach((element: any, index: any) => {
        let is = 1;
        is = index > 1 && itemArray[index - 2].at(-1) === "}" ? 2 : is;

        let isEndPoint = index > 0 ? itemArray[index - is].indexOf("賦予技能") > -1 || itemArray[index - is].indexOf("(enchant)") > -1 || itemArray[index - is].indexOf("(implicit)") > -1 || itemArray[index - is].indexOf("(scourge)") > -1 || itemArray[index - is].indexOf("(rune)") > -1 || itemArray[index - is].indexOf("固定詞綴") > -1 || itemArray[index - is].indexOf("汙染附魔") > -1 || itemArray[index - is].indexOf("附魔") > -1 : false;

        if (element.indexOf('物品等級:') > -1) {
            itemStatStart = index + 2;
        }

        if (element === "--------" && !isEndPoint && itemStatStart && index > itemStatStart && itemStatEnd == itemArray.length - 1) { // 判斷隨機詞綴結束點
            itemStatEnd = index;
        }

        if (element.indexOf('未鑑定') > -1) {
            itemStatEnd = index - 1;
            return
        }
    });

    for (let index = itemStatStart; index < itemStatEnd; index++) {
        if (itemArray[index] !== "--------" && itemArray[index].at(-1) !== "}" && itemArray[index]) {
            let text = itemArray[index].at(0) !== "{" ? itemArray[index - 1] + "\n" + itemArray[index] : itemArray[index];

            let count = (text.match(/\|/g) || []).length;
            if (count > 0) { text = replaceIllustrate(text, count) }

            let [cleansedText, lv] = replaceLevelRange(text);
            console.log(cleansedText, lv);

            //複合詞
            if (cleansedText.indexOf("\n") > -1) {
                tempStat = indentifyStatType(cleansedText, lv, rarityFlag, tempStat, item);

                if (tempStat[tempStat.length - 1].text.stat.indexOf('未找到詞綴') > -1) {
                    tempStat.pop();

                    let stats = cleansedText.split("\n");
                    for (let i = 0; i < stats.length; i++) {
                        itemDisplayStats.push(stats[i]);
                        itemDisplayLevel.push(lv);

                        tempStat = indentifyStatType(stats[i], lv, rarityFlag, tempStat, item);
                    }
                } else {
                    itemDisplayStats.push(cleansedText);
                    itemDisplayLevel.push(lv);
                }
            } else {
                itemDisplayStats.push(cleansedText);
                itemDisplayLevel.push(lv);

                tempStat = indentifyStatType(cleansedText, lv, rarityFlag, tempStat, item);
            }
        }
    }
    let desecrated = [0, 0]; //褻瀆前後綴數量
    tempStat.forEach((element: any, idx: any) => {
        if (element.text.stat.indexOf('未找到詞綴') === -1) {
            let isStatSearch = false;
            let statID = element.text.id; // 詞綴ID
            let apiStatText = element.text.stat; // API 抓回來的詞綴字串
            let itemStatText = itemDisplayStats[idx]; // 物品上的詞綴字串

            console.log(element, statID, apiStatText, itemStatText);

            let itemStatArray = itemStatText.split(' ') // 將物品上的詞綴拆解
            let matchStatArray = apiStatText.split(' ') // 將詞綴資料庫上的詞綴拆解

            let randomMinValue = 0; // 預設詞綴隨機數值最小值為空值(之後修)
            let randomMaxValue = 0; // 預設詞綴隨機數值最大值為空值(之後修)
            let optionValue = 0; // 星團珠寶附魔 / 項鍊塗油配置 / 禁忌烈焰.血肉配置 的 ID

            if (itemStatText.indexOf("試煉地圖") > -1) {
                for (let index = 0; index < itemStatArray.length; index++) {
                    if (!isNaN(itemStatArray[index])) { // 物品詞綴最小值
                        console.log(itemStatArray[index]);
                        randomMinValue = parseFloat(itemStatArray[index].replace(/[+-]^\D+/g, ''));
                        randomMinValue = isNaN(randomMinValue) ? 0 : randomMinValue;
                    }
                }
            } else {
                for (let index = 0; index < itemStatArray.length; index++) { // 比較由空格拆掉後的詞綴陣列元素
                    if (randomMinValue && itemStatArray[index] !== matchStatArray[index]) { // 物品詞綴最大值
                        randomMaxValue = parseFloat(itemStatArray[index].replace(/[+-]^\D+/g, ''));
                        randomMaxValue = isNaN(randomMaxValue) ? 0 : randomMaxValue;
                    }
                    if (!randomMinValue && itemStatArray[index] !== matchStatArray[index]) { // 物品詞綴最小值
                        randomMinValue = parseFloat(itemStatArray[index].replace(/[+-]^\D+/g, ''));
                        randomMinValue = isNaN(randomMinValue) ? 0 : randomMinValue;
                        if (matchStatArray[index]) {
                            if (matchStatArray[index].indexOf('，#') > -1) { // 處理隨機數值在'，'後的詞綴(無法用空格符號 split)
                                let tempStat = itemStatArray[index].substring(itemStatArray[index].indexOf('，') + 1);
                                randomMinValue = parseFloat(tempStat.replace(/[+-]^\D+/g, ''));
                            } else if (matchStatArray[index].indexOf('：#') > -1) { // 處理隨機數值在'：'後的詞綴(無法用空格符號 split)
                                let tempStat = itemStatArray[index].substring(itemStatArray[index].indexOf('：') + 1);
                                randomMinValue = parseFloat(tempStat.replace(/[+-]^\D+/g, ''));
                            }
                        }
                    }
                }
                // 處理黏在一起的
                if (randomMinValue == 0 && itemStatArray.length == 1 && (itemStatArray[0].match(/\d+/g))?.length > 0) {
                    randomMinValue = itemStatArray[0].match(/\d+/g)[0];
                }
            }
            // }

            // API 詞綴只有"增加"，但物品可能有"減少"詞綴相關處理
            if ((apiStatText.includes('增加') && itemStatText.includes('減少')) || (apiStatText.includes('減少') && itemStatText.includes('增加')) || (apiStatText.includes('恢復') && itemStatText.includes('失去'))) {
                // apiStatText = apiStatText.replace('增加', '減少');
                randomMinValue = -randomMinValue;
            }

            // 物品中包含 "# 至 #" 的詞綴，在官方市集搜尋中皆以相加除二作搜尋
            if (randomMaxValue && randomMinValue != randomMaxValue) {
                randomMinValue = (randomMinValue + randomMaxValue) / 2;
                randomMaxValue = 0;
            }

            // let rangeStatID = statID;

            //聖物範圍
            // if ((rangeStatID === 'sanctum.stat_3970123360' || rangeStatID === 'sanctum.stat_1583320325' || rangeStatID === 'sanctum.stat_2287831219') && (this.item.basic === '陶罐聖物' || this.item.basic === '聖經聖物')) {
            //   rangeStatID = rangeStatID + '_1';
            // } else if (rangeStatID === 'sanctum.stat_386901949' && (this.item.basic === '寶箱聖物' || this.item.basic === '香爐聖物')) {
            //   rangeStatID = rangeStatID + '_1';
            // }

            //珠寶範圍
            // if (this.item.basic.indexOf('時迭') > -1 && this.data.datas.ranges[rangeStatID + '_1'] !== 'undefined') {
            //   rangeStatID = rangeStatID + '_1';
            // }

            item.searchStats.push({
                "id": statID,
                "level": element.level,
                "text": apiStatText,
                "option": optionValue,
                "min": randomMinValue,
                "max": randomMaxValue === 0 ? '' : randomMaxValue,
                "isValue": randomMinValue ? true : false,
                "isSearch": isStatSearch,
                "type": element.type,
                // "rangeMin": typeof this.data.datas.ranges[rangeStatID] !== 'undefined' && typeof this.data.datas.ranges[rangeStatID][this.item.type.substring(this.item.type.indexOf('.') > -1 ? this.item.type.indexOf('.') + 1 : 0)] !== 'undefined' ? this.data.datas.ranges[rangeStatID][this.item.type.substring(this.item.type.indexOf('.') + 1)].min : null,
                // "rangeMax": typeof this.data.datas.ranges[rangeStatID] !== 'undefined' && typeof this.data.datas.ranges[rangeStatID][this.item.type.substring(this.item.type.indexOf('.') > -1 ? this.item.type.indexOf('.') + 1 : 0)] !== 'undefined' ? this.data.datas.ranges[rangeStatID][this.item.type.substring(this.item.type.indexOf('.') + 1)].max : null
            })
        } else {
            //實作未找到
            if (itemDisplayStats[idx].indexOf('褻瀆前綴') > -1 || itemDisplayStats[idx].indexOf('褻瀆後綴') > -1) {
                itemDisplayStats[idx].indexOf('前') > -1 ? desecrated[0]++ : desecrated[1]++;
            } else {
                item.searchStats.push({
                    "id": "",
                    "level": element.level,
                    "text": itemDisplayStats[idx],
                    "option": "",
                    "min": '',
                    "max": '',
                    "isValue": false,
                    "isSearch": false,
                    "type": element.type
                })
            }
        }
    });

    // 整合相同 ID 的詞綴數值 (例如處理複合詞綴或重複出現的屬性)
    const groupedStats = item.searchStats.reduce((accumulator: any, currentItem: any) => {
        const { id, min } = currentItem;

        // If the category doesn't exist yet, initialize it at 0
        // 如果沒有 ID (如未找到詞綴)，不進行合併，使用唯一 Key 保留原始資料
        if (!id) {
            const uniqueKey = `unidentified_${Math.random()}`;
            accumulator[uniqueKey] = { ...currentItem };
            return accumulator;
        }

        if (!accumulator[id]) {
            // 第一次遇到該 ID，直接複製物件，並確保 min/max 是數值型態
            accumulator[id] = { ...currentItem, min: Number(min) || 0, max: Number(currentItem.max) || 0 };
        } else {
            // 累加最小值 (min)
            accumulator[id].min += (Number(min) || 0);
            // 如果有最大值 (max)，也一併累加
            if (currentItem.max) accumulator[id].max = (Number(accumulator[id].max) || 0) + Number(currentItem.max);
            // 有累加發生，將 level 設為 -1 標記為合併詞綴
            accumulator[id].level = -1;
        }
        return accumulator;
    }, {});

    // 將物件轉回陣列，以便後續的 .forEach 和 .unshift 正常運作
    item.searchStats = Object.values(groupedStats);

    console.log(item.searchStats);

    // 元素抗性偽屬性
    let resistances = 0;
    item.searchStats.forEach((e: any) => {
        if (pseudoElementalResistance.some((s: any) => s === e.id)) {
            if (e.id == 'explicit.stat_2901986750' || e.id == 'implicit.stat_2901986750' || e.id == 'fractured.stat_2901986750' || e.id == 'rune.stat_2901986750' || e.id == 'desecrated.stat_2901986750' || e.id == 'sanctum.stat_3128852541') {
                resistances += (e.min * 3);
            } else {
                resistances += e.min;
            }
        }
    });
    if (resistances > 0) {
        item.searchStats.unshift({
            "id": "pseudo.pseudo_total_elemental_resistance",
            "text": '+#% 元素抗性',
            "option": "",
            "min": resistances,
            "max": '',
            "isValue": false,
            "isSearch": false,
            "type": '偽屬性'
        });
    }
    // 褻瀆偽屬性
    if (desecrated.reduce((a, b) => a + b) > 0) {
        let [p, s] = desecrated;
        item.searchStats.push({
            "id": "pseudo.pseudo_number_of_unrevealed_mods",
            "text": '未揭露褻瀆數量',
            "option": "",
            "min": p + s,
            "max": p + s,
            "isValue": false,
            "isSearch": false,
            "type": '褻瀆'
        });
        if (p > 0) {
            item.searchStats.push({
                "id": "pseudo.pseudo_number_of_unrevealed_prefix_mods",
                "text": '未揭露褻瀆前綴數量',
                "option": "",
                "min": p,
                "max": p,
                "isValue": false,
                "isSearch": false,
                "type": '褻瀆'
            });
            if (s > 0) {
                item.searchStats.push({
                    "id": "pseudo.pseudo_number_of_unrevealed_suffix_mods",
                    "text": '未揭露褻瀆後綴數量',
                    "option": "",
                    "min": s,
                    "max": s,
                    "isValue": false,
                    "isSearch": false,
                    "type": '褻瀆'
                });
            }
        }
    }
}

function indentifyStatType(stat: string, lv: any = -1, rarityFlag: any, tempStat: any[], item: any) {
    if (stat.indexOf('賦予技能') > -1) { // 技能屬性
        console.log("技能");
        let tempA = stat.split(' ');
        stat = "賦予技能: 等級 # " + tempA[tempA.length - 1];
        tempStat.push({ text: getStat(item, stat, 'skill'), type: "技能", category: "skill" });
    } else if (stat.indexOf('(crafted)') > -1) { // 工藝屬性
        console.log("工藝");
        stat = stat.replaceAll('(crafted)', '').trim(); // 刪除(crafted)字串
        tempStat.push({ text: getStat(item, stat, 'crafted'), type: "工藝", category: "crafted" });
    } else if (stat.indexOf('(implicit)') > -1 || stat.indexOf('固定詞綴') > -1) { // 固定屬性
        console.log("固定");
        stat = stat.replaceAll(' (implicit)', '').trim(); // 碑牌多空格
        stat = stat.replaceAll('(implicit)', '').trim(); // 刪除(implicit)字串
        stat = stat.replace('Slots', 'Slot'); //插槽英文複數
        tempStat.push({ text: getStat(item, stat, 'implicit'), type: "固定", category: "implicit" });
    } else if (stat.indexOf('(rune)') > -1) { //增幅屬性
        console.log("增幅");
        stat = stat.replaceAll(' (rune)', '').trim(); // 刪除(rune)字串
        stat = stat.replaceAll('(rune)', '').trim(); // 刪除(rune)字串
        stat = replacePart(item, stat);
        tempStat.push({ text: getStat(item, stat, 'rune'), type: "增幅", category: "rune" });
    } else if (stat.indexOf('(enchant)') > -1) { // 附魔
        console.log("附魔");
        stat = stat.replaceAll('(enchant)', '').trim(); // 刪除(enchant)字串
        stat = replacePart(item, stat);
        tempStat.push({ text: getStat(item, stat, 'enchant'), type: "附魔", category: "enchant" });
    } else if (stat.indexOf('(desecrated)') > -1) { //褻瀆
        console.log("褻瀆");
        stat = stat.replaceAll('(desecrated)', '').trim(); // 刪除(desecrated)字串
        stat = replacePart(item, stat);
        tempStat.push({ text: getStat(item, stat, 'desecrated'), type: "褻瀆", category: "desecrated", level: lv });
    } else if (stat.indexOf('(fractured)') > -1) { //破裂
        console.log("破裂");
        stat = stat.replaceAll('(fractured)', '').trim(); // 刪除(fractured)字串
        stat = replacePart(item, stat);
        tempStat.push({ text: getStat(item, stat, 'fractured'), type: "破裂", category: "fractured", level: lv });
    } else if (item.type.indexOf('sanctum') > -1) { //聖所詞綴
        console.log("聖所");
        tempStat.push({ text: getStat(item, stat, 'sanctum'), type: "聖所", category: "sanctum", level: lv });
    } else if (rarityFlag) { //傳奇裝詞綴
        console.log("傳奇");
        stat = replacePart(item, stat);;
        tempStat.push({ text: getStat(item, stat, 'explicit'), type: "傳奇", category: "explicit", level: lv });
    } else { // 隨機屬性
        console.log("隨機");
        stat = stat.replace('Slots', 'Slot'); //插槽英文複數
        stat = replacePart(item, stat);
        tempStat.push({ text: getStat(item, stat, 'explicit'), type: "隨機", category: "explicit", level: lv });
    }

    return tempStat;
}

//取代0.5新增字樣
function replaceLevelRange(text: any) {
    text = text.replace(" — 無法使用的值", "");

    let lv = -1;

    //取代{}字樣
    let po = text.indexOf("\n");

    if (text.indexOf("固定詞綴") > -1) {
        text += "(implicit)";
    }
    if (text.indexOf("已褻瀆") > -1) {
        text += "(desecrated)";
    }
    if (text.indexOf("已工藝") > -1) {
        text += "(crafted)";
    }
    if (text.indexOf("已破裂") > -1) {
        text += "(fractured)";
    }
    if (text.indexOf("汙染附魔") > -1 || text.indexOf(" 附魔 ") > -1) {
        text += "(enchant)";
    }

    if (text.indexOf("階層") > -1) {
        let pol = text.indexOf("階層");
        lv = text.substring(pol + 3, pol + 4);
    }

    text = text.substring(po + 1);

    let c = (text.match(/\(/g) || []).length;
    for (let i = 0; i < c; i++) {
        let poS = text.indexOf("(");
        let poE = text.indexOf(")");

        if (poE > poS) {
            let fullText = text.substring(poS, poE + 1);

            text = statTypes.some((e: any) => { return fullText.indexOf(e[0]) > -1 }) ? text : text.replace(fullText, "");
        }
    }

    return [text, lv];
}

//取得插槽數量
function getSocketNumber(text: string, newLine: string): number {
    let start = text.indexOf('插槽: ');
    if (start > -1) {
        let socPos = text.substring(start + 4);
        return socPos.substring(0, socPos.indexOf(newLine)).trim().split(" ").length;
    }
    return 0;
}

//物品防禦分析
function itemDefencesAnalysis(itemArray: any, item: any) {
    let start = 0;
    itemArray.forEach((line: any) => {
        if (start == 1 && line.indexOf('品質') === -1 && line.indexOf('--------') === -1) {
            let posS = line.indexOf(':'), posE = line.indexOf("(");
            let type = line.substring(0, posS);
            let value = +line.substring(posS + 2, posE > -1 ? posE - 1 : line.length).replace('%', '');

            item.searchDefences.push({
                text: type,
                type: '防禦',
                min: value,
                max: '',
                isSearch: false
            });
        }
        if (line.indexOf('--------') > -1) start += 1;
    });
}

//刪除不需要字串
function deleteUnUseString(itemArray: any) {
    //之後查看
    if (itemArray[2].indexOf('你無法使用這項裝備，它的數值將被忽略') > -1) {
        itemArray.splice(2, 2);
    }

    let priceText = itemArray[itemArray.length - 2];
    if (priceText.indexOf(': ~b/o') > -1 || priceText.indexOf(': ~price') > -1 || priceText.indexOf('Note:') > -1) {
        // 處理在高倉標價後搜尋的物品陣列
        itemArray.splice(itemArray.length - 3, 2);
    }

    return itemArray;
}

//取代部分字樣
function replacePart(item: any, text: any) {
    if (item.type.indexOf('weapon') > -1 && (text.indexOf('攻擊速度') > -1 || text.indexOf('命中值') > -1) && text.length < 12) {//攻擊速度 (部分) || 命中值 (部分)
        text = text.replace('攻擊速度', '攻擊速度 (部分)');
        text = text.replace('命中值', '命中值 (部分)');
    } else if (item.type.indexOf('armour') > -1 && text.indexOf('和') === -1 && (text.indexOf('最大能量護盾') > 0 || text.indexOf('閃避值') > 0 || text.indexOf('護甲值') > 0 || text.indexOf('格擋率') > 0) && text.length < 12 && text.indexOf('每有') === -1) { //最大能量護盾 (部分) || 閃避值 (部分) || 護甲值 (部分) || 格擋率 (部分)
        text = text.replace('最大能量護盾', '最大能量護盾 (部分)');
        text = text.replace('閃避值', '閃避值 (部分)');
        text = text.replace('護甲值', '護甲值 (部分)');
        text = text.replace('格擋率', '格擋率 (部分)');
    } else if (item.type.indexOf('armour') > -1 && (text.indexOf('護甲值增加') == 0 || text.indexOf('閃避值增加') == 0 || text.indexOf('格擋率增加') == 0)) { // 護甲值增加 (部分) || 閃避值增加 (部分) || 格擋率增加 (部分)
        text = text + " (部分)";
    } else if (item.type.indexOf('flask') > -1 && text.indexOf('持續時間') > -1 && text.indexOf('增加') === 0) { //修復傳奇藥劑被增加字樣
        text = text + (item.basic.indexOf('護符') > -1 ? "（護符）" : "（藥劑）");
    }

    return text;
}

//取得詞綴
function getStat(item: any, stat: string, type: any): any {
    let mdStat = cleanKey(stat);

    // 1. 正規化：處理增加/減少、更多/更少等字串
    if (!(mdStat.includes('增加') && mdStat.includes('減少'))) {
        if (reduceStrs.some((str: any) => mdStat.includes(str))) {
            mdStat = mdStat.replace('增加', '減少');
        } else if (!(mdStat.includes('對你的擊中') && mdStat.includes('暴擊率'))) {
            mdStat = mdStat.replace('減少', '增加');
        }
    }

    if (!(mdStat.includes('更多') && mdStat.includes('更少'))) {
        if (moreStrs.some((str: any) => mdStat.includes(str))) {
            mdStat = mdStat.replace('更多', '更少');
        } else {
            mdStat = mdStat.replace('更少', '更多');
        }
    }

    if (mdStat.startsWith('擊殺時')) mdStat = mdStat.replace('失去', '恢復');

    // 2. 從預先處理好的 processedStats 進行 O(1) 查詢
    const categoryObj = processedStats[type];
    const candidates = categoryObj ? categoryObj[mdStat] : null;

    if (!candidates || candidates.length === 0) {
        return { id: '', stat: mdStat + "(未找到詞綴)" };
    }

    // 收集所有可能的 ID 列表
    let possibleIds: string[] = [];
    candidates.forEach((cand: any) => {
        cand.ids.forEach((id: string) => {
            if (!possibleIds.includes(id)) {
                possibleIds.push(id);
            }
        });
    });

    // 3. 衝突處理：如果一個文字對應多個 ID，套用過濾規則
    let finalId = possibleIds[0];
    if (possibleIds.length > 1) {
        const filteredId = possibleIds.find((id: any) => {
            // 傳局護符/擊殺恢復魔力修正
            if (item.category === 'unique' && (id === 'explicit.stat_1416292992' || id === 'explicit.stat_1604736568')) return false;
            // 擊中流血修正
            if (item.category === 'unique' && item.basic === '鎖鍊鎖甲' && id === 'explicit.stat_1519615863') return false;
            if (item.category === 'unique' && item.basic === '教徒巨錘' && id === 'explicit.stat_3423694372') return false;
            // 精魂百分比修正 (戒指 vs 其他)
            if (id === 'explicit.stat_3984865854' && !item.type.includes('ring')) return true;
            if (id === 'explicit.stat_1416406066' && item.type.includes('ring')) return false;
            // 貪婪長杖精魂修正
            if (item.category === 'unique' && item.basic === '貪婪長杖' && id === 'explicit.stat_3981240776') return false;
            // 擊中目眩修正 (武器 vs 其他)
            if (id === 'explicit.stat_3146310524' && !item.type.includes('weapon')) return false;
            if (id === 'explicit.stat_2933846633' && item.type.includes('weapon')) return false;
            // 橡木巨錘餘震修正
            if (item.category === 'unique' && item.basic === '橡木巨錘' && id === 'explicit.stat_1157523820') return false;

            return true;
        });
        if (filteredId) finalId = filteredId;
    }

    // 找到對應的原始 API 詞綴字串
    const matchedCandidate = candidates.find((c: any) => c.ids.includes(finalId)) || candidates[0];
    const finalStatText = matchedCandidate.originalKey;

    return { id: finalId, stat: finalStatText };
}

//取代說明字樣
function replaceIllustrate(text: any, count: any) {
    for (let i = 0; i < count; i++) {
        let poS = text.indexOf("[");
        let poM = text.indexOf("|");
        let poE = text.indexOf("]");

        if (poM !== -1 && poE > poM && (poM - poS < 40)) {
            let fullText = text.substring(poS, poE + 1);
            let replace = text.substring(poM + 1, poE);

            // console.log(poS, poM, poE, fullText, replace);

            text = text.replace(fullText, replace);
        }
    }

    return text;
}