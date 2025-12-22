import { lastValueFrom } from "rxjs";
import { AppService } from "../app.service";
import { HttpErrorResponse } from "@angular/common/http";
import { inject } from "@angular/core";

export class Data {
    private poe_service = inject(AppService);
    //原始資料
    public datas: any = {
        items: [], // 交易網物品 API 資料
        stats: [],  // 交易網詞綴 API 資料
        ranges: [] //詞綴範圍資料
    };
    //物品資料
    public basics: any = {
        categorizedItems: [], // 有分類的物品資料
        map: { // 地圖基底
            option: [],
            chosenM: '無',
            isSearch: false,
        },
        gem: { // 技能寶石基底
            option: [],
            chosenG: '無',
            isSearch: false,
        }
    };
    //詞綴資料
    public stats: any = {
        implicit: [], // 固定屬性
        explicit: [], // 隨機屬性
        wrap: [], //拆行詞綴
        enchant: [], // 附魔詞綴
        rune: [], // 增幅詞綴
        skill: [], //技能詞綴
        allocates: [], // 項鍊塗油配置附魔詞綴
        sanctum: [], //聖所詞綴
        desecrated: [], //褻瀆詞綴
        fractured: [] //破裂詞綴
    }

    constructor() {
        this.loadData();
    }

    public async loadData() {
        let loadlocal = false;

        (<any>window).ipcRenderer.on('reply-local-items', (event: any, arg: any) => {
            this.datas.items = arg;
        });
        (<any>window).ipcRenderer.on('reply-local-stats', (event: any, arg: any) => {
            this.datas.stats = arg;
        });

        const allItems = this.poe_service.getOfficialItemData();
        const allStats = this.poe_service.getOfficialStatesData();
        const allStatsRanges = this.poe_service.getStatsRangesData();

        this.datas.items = await lastValueFrom(allItems).catch((error: HttpErrorResponse) => {
            console.log("error: ", error);
            loadlocal = true;
            (<any>window).ipcRenderer.send('get-local-items');
        });
        this.datas.stats = await lastValueFrom(allStats).catch((error: HttpErrorResponse) => {
            console.log("error: ", error);
            loadlocal = true;
            (<any>window).ipcRenderer.send('get-local-stats');
        });
        this.datas.ranges = await lastValueFrom(allStatsRanges).then((ranges: any) => ranges.ranges);

        //更新本地資料
        if (!loadlocal) {
            (<any>window).ipcRenderer.send('update-local-items', this.datas.items);
            (<any>window).ipcRenderer.send('update-local-stats', this.datas.stats);
        }

        this.dealWithitemsData();
        this.dealWithstatsData();
    }

    //物品格式化
    dealWithitemsData() { // 物品 API
        let accessoryIndex = 0; //飾品
        let armourIndex = 0; //護甲
        let flasksIndex = 0; //藥水
        let jewelIndex = 0; //珠寶
        let weaponIndex = 0; //武器
        let mapIndex = 0; //地圖
        let sanctumIndex = 0; //聖所
        this.basics.categorizedItems.length = 0;
        this.basics.map.option.length = 0;
        this.basics.gem.option.length = 0;

        let result = this.datas.items.result;
        //"id": "accessory", "label": "飾品"
        result[result.findIndex((e: any) => e.id === "accessory")].entries.forEach((element: any) => {
            const basetype = ["赤紅項鍊", "生皮腰帶", "鍛鐵戒指"];

            if (basetype.includes(element.type) && !('flags' in element)) {
                accessoryIndex += 1;
            }

            switch (accessoryIndex) {
                case 1: // 項鍊起始點 { "type": "赤紅項鍊", "text": "赤紅項鍊" }
                    element.name = "項鍊";
                    element.option = "accessory.amulet";
                    this.basics.categorizedItems.push(element);
                    break;
                case 2: // 腰帶起始點 { "type": "生皮腰帶", "text": "生皮腰帶" }
                    element.name = "腰帶";
                    element.option = "accessory.belt";
                    this.basics.categorizedItems.push(element);
                    break;
                case 3: // 戒指起始點 { "type": "鍛鐵戒指", "text": "鍛鐵戒指" }
                    element.name = "戒指";
                    element.option = "accessory.ring";
                    this.basics.categorizedItems.push(element);
                    break;
                default:
                    break;
            }
        });
        //"id": "armour", "label": "護甲"
        result[result.findIndex((e: any) => e.id === "armour")].entries.forEach((element: any) => {
            const basetype = ["皮革背心", "生皮長靴", "枝條法器", "麂皮護腕", "黃金面紗", "皮革輕盾", "朽木塔盾", "寬頭箭袋"];

            if (basetype.includes(element.type) && !('flags' in element)) {
                armourIndex += 1;
            }

            switch (armourIndex) {
                case 1: // 胸甲起始點 { "type": "皮革背心", "text": "皮革背心" }
                    element.name = "胸甲";
                    element.option = "armour.chest";
                    this.basics.categorizedItems.push(element);
                    break;
                case 2: // 鞋子起始點 { "type": "生皮長靴", "text": "生皮長靴" }
                    element.name = "鞋子";
                    element.option = "armour.boots";
                    this.basics.categorizedItems.push(element);
                    break;
                case 3: // 法器起始點 { "type": "枝條法器", "text": "枝條法器" }
                    element.name = "法器";
                    element.option = "armour.focus";
                    this.basics.categorizedItems.push(element);
                    break;
                case 4: // 手套起始點 { "type": "麂皮護腕", "text": "麂皮護腕" }
                    element.name = "手套";
                    element.option = "armour.gloves";
                    this.basics.categorizedItems.push(element);
                    break;
                case 5: // 頭盔起始點 { "type": "黃金面紗", "text": "黃金面紗" }
                    element.name = "頭盔";
                    element.option = "armour.helmet";
                    this.basics.categorizedItems.push(element);
                    break;
                case 6: // 輕盾起始點 { "type": "皮革輕盾", "text": "皮革輕盾" }
                    element.name = "輕盾";
                    element.option = "armour.buckler";
                    this.basics.categorizedItems.push(element);
                    break;
                case 7: // 盾牌起始點 { "type": "朽木塔盾", "text": "朽木塔盾" }
                    element.name = "盾";
                    element.option = "armour.shield";
                    this.basics.categorizedItems.push(element);
                    break;
                case 8: // 箭袋起始點 { "type": "寬頭箭袋", "text": "寬頭箭袋" }
                    element.name = "箭袋";
                    element.option = "armour.quiver";
                    this.basics.categorizedItems.push(element);
                    break;
                default:
                    break;
            }
        });
        //"id": "flask", "label": "藥劑"
        result[result.findIndex((e: any) => e.id === "flask")].entries.forEach((element: any) => {
            const basetype = ["解凍護符", "低階生命藥劑"];

            if (basetype.includes(element.type) && !('flags' in element)) {
                flasksIndex += 1;
            }

            switch (flasksIndex) {
                case 1: // 護符起始點 { "type": "解凍護符", "text": "解凍護符" }
                    element.name = "護符";
                    element.option = "flask"; //之後檢查
                    this.basics.categorizedItems.push(element);
                    break;
                case 2: // 藥劑起始點 { "type": "低階生命藥劑", "text": "低階生命藥劑" }
                    element.name = "藥劑";
                    element.option = "flask";
                    this.basics.categorizedItems.push(element);
                    break;
                default:
                    break;
            }
        });
        //"id": "jewel", "label": "珠寶"
        result[result.findIndex((e: any) => e.id === "jewel")].entries.forEach((element: any) => {
            const basetype = ["翠綠碧雲"];

            if (basetype.includes(element.type) && !('flags' in element)) {
                jewelIndex += 1;
            }

            switch (jewelIndex) {
                case 1: // 珠寶起始點 { "type": "翠綠碧雲", "text": "翠綠碧雲" }
                    element.name = "珠寶";
                    element.option = "jewel";
                    this.basics.categorizedItems.push(element);
                    break;
                default:
                    break;
            }
        });
        //"id": "weapon", "label": "武器"
        result[result.findIndex((e: any) => e.id === "weapon")].entries.forEach((element: any) => {
            const basetype = ["分裂鏈錘", "鈍斧", "木製棍棒", "硬木長矛", "闊劍", "雜響權杖", "凋零法杖", "粗製弓", "臨時十字弓", "纏繞細杖", "灰燼長杖", "變形魔符", "分裂巨斧", "墮落巨棍棒", "鍛鐵巨劍"]

            if (basetype.includes(element.type) && !('flags' in element)) {
                weaponIndex += 1;
            }

            switch (weaponIndex) {
                case 1: // 鏈錘起始點 { "type": "分裂鏈錘", "text": "分裂鏈錘" }
                    element.name = "鏈錘";
                    element.option = "weapon.flail";
                    element.weapon = "weapon.onemelee" // "weapon.one" 單手武器
                    this.basics.categorizedItems.push(element);
                    break;
                case 2: // 單手斧起始點 { "type": "鈍斧", "text": "鈍斧" }
                    element.name = "單手斧";
                    element.option = "weapon.oneaxe";
                    element.weapon = "weapon.onemelee" // "weapon.one" 單手武器
                    this.basics.categorizedItems.push(element);
                    break;
                case 3: // 單手錘起始點 { "type": "木製棍棒", "text": "木製棍棒" }
                    element.name = "單手錘";
                    element.option = "weapon.onemace";
                    element.weapon = "weapon.onemelee" // "weapon.one" 單手武器
                    this.basics.categorizedItems.push(element);
                    break;
                case 4: // 長矛起始點 { "type": "硬木長矛", "text": "硬木長矛" }
                    element.name = "長矛";
                    element.option = "weapon.spear";
                    element.weapon = "weapon.onemelee" // "weapon.one" 單手武器
                    this.basics.categorizedItems.push(element);
                    break;
                case 5: // 單手劍起始點 { "type": "闊劍", "text": "闊劍" }
                    element.name = "單手劍";
                    element.option = "weapon.onesword";
                    element.weapon = "weapon.onemelee" // "weapon.one" 單手武器
                    this.basics.categorizedItems.push(element);
                    break;
                case 6: // 權杖起始點 { "type": "雜響權杖", "text": "雜響權杖" }
                    element.name = "權杖";
                    element.option = "weapon.sceptre";
                    element.weapon = "weapon.caster";
                    this.basics.categorizedItems.push(element);
                    break;
                case 7: // 法杖起始點 { "type": "凋零法杖", "text": "凋零法杖" }
                    element.name = "法杖";
                    element.option = "weapon.wand";
                    element.weapon = "weapon.caster";
                    this.basics.categorizedItems.push(element);
                    break;
                case 8: // 弓起始點 { "type": "粗製弓", "text": "粗製弓" }
                    element.name = "弓";
                    element.option = "weapon.bow";
                    element.weapon = "weapon.ranged";
                    // element.weapon = "weapon.one"
                    this.basics.categorizedItems.push(element);
                    break;
                case 9: // 十字弓起始點 { "type": "鏽劍", "text": "鏽劍" }
                    element.name = "十字弓";
                    element.option = "weapon.crossbow";
                    element.weapon = "weapon.ranged";
                    // element.weapon = "weapon.one"
                    this.basics.categorizedItems.push(element);
                    break;
                case 10: // 細杖起始點 { "type": "纏繞細杖", "text": "纏繞細杖" }
                    element.name = "細杖";
                    element.option = "weapon.warstaff";
                    element.weapon = "weapon.twomelee";
                    this.basics.categorizedItems.push(element);
                    break;
                case 11: // 長杖起始點{ "type": "灰燼長杖", "text": "灰燼長杖" }
                    element.name = "長杖";
                    element.option = "weapon.staff";
                    element.weapon = "weapon.caster";
                    this.basics.categorizedItems.push(element);
                    break;
                case 12: // 魔符起始點{ "type": "變形魔符", "text": "變形魔符" }
                    element.name = "魔符";
                    element.option = "weapon.talisman";
                    element.weapon = "weapon.twomelee";
                    this.basics.categorizedItems.push(element);
                    break;
                case 13: // 雙手斧起始點 { "type": "分裂巨斧", "text": "分裂巨斧" }
                    element.name = "雙手斧";
                    element.option = "weapon.twoaxe";
                    element.weapon = "weapon.twomelee";
                    this.basics.categorizedItems.push(element);
                    break;
                case 14: // 雙手錘起始點 { "type": "墮落巨棍棒", "text": "墮落巨棍棒" }
                    element.name = "雙手錘";
                    element.option = "weapon.twomace";
                    element.weapon = "weapon.twomelee";
                    this.basics.categorizedItems.push(element);
                    break;
                case 15: // 雙手劍起始點 { "type": "鍛鐵巨劍", "text": "鍛鐵巨劍" }
                    element.name = "雙手劍";
                    element.option = "weapon.twosword";
                    element.weapon = "weapon.twomelee";
                    this.basics.categorizedItems.push(element);
                    break;
                default:
                    break;
            }
        });
        //"id": "maps", "label": "地圖"
        result[result.findIndex((e: any) => e.id === "map")].entries.forEach((element: any) => {
            const basetype = ["探險日誌", "幻像異界", "地圖鑰匙（階級 1）", "遠古危機碎片", "意志的測試代幣", "巨靈之幣", "裂痕碑牌", "最後通牒雕刻", "怯懦之運"] // 地圖起始點 { "type": "探險日誌", "text": "探險日誌" }

            if (basetype.includes(element.type) && !('flags' in element)) {
                mapIndex += 1;
            }

            switch (mapIndex) {
                case 1: // 日誌起始點 { "type": "探險日誌", "text": "探險日誌" }
                    element.name = "日誌";
                    element.option = "map.logbook";
                    this.basics.categorizedItems.push(element);
                    break;
                case 2: // 終局物品起始點 { "type": "幻像異界", "text": "幻像異界" }
                    element.name = "終局物品";
                    element.option = "map";
                    this.basics.categorizedItems.push(element);
                    break;
                case 3: // 地圖起始點 { "type": "地圖鑰匙（階級 1）", "text": "地圖鑰匙（階級 1）" }
                    this.basics.map.option.push(element.type);
                    break;
                case 4: // 地圖碎片起始點 { "type": "遠古危機碎片", "text": "遠古危機碎片" }
                    // element.name = "地圖碎片";
                    // element.option = "map.fragment";
                    // this.basics.categorizedItems.push(element);
                    this.basics.map.option.push(element.type);
                    break;
                case 5: // 巔峰鑰匙起始點 { "type": "意志的測試代幣", "text": "意志的測試代幣" } //之後檢查
                    element.name = "巔峰鑰匙";
                    element.option = "map.bosskey";
                    this.basics.categorizedItems.push(element);
                    break;
                case 6: // 巨靈之幣起始點 { "type": "巨靈之幣", "text": "巨靈之幣" }
                    // element.name = "巨靈之幣";
                    // element.option = "map.barya";
                    // this.basics.categorizedItems.push(element);
                    this.basics.map.option.push(element.type);
                    break;
                case 7: // 碑牌日誌起始點 { "type": "裂痕碑牌", "text": "裂痕碑牌" }
                    element.name = "碑牌";
                    element.option = "map.tablet";
                    this.basics.categorizedItems.push(element);
                    break;
                case 8: // 通牒鑰匙起始點 { "type": "最後通牒雕刻", "text": "最後通牒雕刻" }
                    // element.name = "通牒鑰匙";
                    // element.option = "map.ultimatum";
                    // this.basics.categorizedItems.push(element);
                    this.basics.map.option.push(element.type);
                    break;
                case 9: // 地圖碎片起始點 { "type": "怯懦之運", "text": "怯懦之運" }
                    element.name = "地圖碎片";
                    element.option = "map.fragment";
                    this.basics.categorizedItems.push(element);
                    break;
            }

            // if (element.type.type.indexOf("探險日誌") > -1 || element.type.type.indexOf("地圖")) {
            //   this.basics.map.option.push(element.type);
            // } else {
            //   this.basics.categorizedItems.push(element);
            // }
        });
        //"id": "gems", "label": "技能寶石"
        result[result.findIndex((e: any) => e.id === "gem")].entries.forEach((element: any) => {
            this.basics.gem.option.push(element.text);
        });
        //"id": "sanctum"
        result[result.findIndex((e: any) => e.id === "sanctum")].entries.forEach((element: any) => {
            const basetype = ["古甕聖物"];

            if (basetype.includes(element.type) && !('flags' in element)) {
                sanctumIndex += 1;
            }

            switch (sanctumIndex) {
                case 1: // 聖物起始點 { "type": "古甕聖物", "text": "古甕聖物" }
                    element.name = "聖物";
                    element.option = "sanctum.relic";
                    this.basics.categorizedItems.push(element);
                    break;
                // case 2: // 聖域研究起始點 { "type": "聖域寶庫研究", "text": "聖域寶庫研究" }
                //   element.name = "聖域研究";
                //   element.option = "sanctum.research";
                //   this.options.mapBasic.option.push(element.type);
                //   break;
                default:
                    break;
            }
        });

        //清除資料
        this.datas.items = [];
    }

    //詞綴格式化
    dealWithstatsData() {
        let result = this.datas.stats.result;
        //隨機屬性
        result[result.findIndex((e: any) => e.id === "explicit")].entries.forEach((element: any, index: any) => {
            let text = element.text;
            let count = (text.match(/\|/g) || []).length;
            //處理說明字串
            if (count > 0) {
                text = this.replaceIllustrate(text, count);
            }
            //處理折行詞綴
            if (text.includes('\n')) {
                this.stats.wrap.push(text);
            }

            this.stats.explicit.push(text, element.id);
        })
        //固定屬性
        result[result.findIndex((e: any) => e.id === "implicit")].entries.forEach((element: any, index: any) => {
            let text = element.text;
            let count = (text.match(/\|/g) || []).length;
            //處理說明字串
            if (count > 0) {
                text = this.replaceIllustrate(text, count);
            }
            //處理折行詞綴
            if (text.includes('\n')) {
                this.stats.wrap.push(text);
            }

            this.stats.implicit.push(text, element.id)
        })
        //附魔詞綴
        result[result.findIndex((e: any) => e.id === "enchant")].entries.forEach((element: any, index: any) => {
            let text = element.text;
            // if (element.id === "enchant.stat_2954116742") { // 項鍊塗油配置附魔詞綴
            //   element.option.options.forEach((element, index) => {
            //     this.allocatesStats.push(element.text, (element.id).toString())
            //   })
            // }
            let count = (text.match(/\|/g) || []).length;
            //處理說明字串
            if (count > 0) {
                text = this.replaceIllustrate(text, count);
            }
            //處理折行詞綴
            if (text.includes('\n')) {
                this.stats.wrap.push(text);
            }

            this.stats.enchant.push(text, element.id);
        })
        //增幅詞綴
        result[result.findIndex((e: any) => e.id === "rune")].entries.forEach((element: any, index: any) => {
            let text = element.text;
            let count = (text.match(/\|/g) || []).length;
            //處理說明字串
            if (count > 0) {
                text = this.replaceIllustrate(text, count);
            }
            //處理折行詞綴
            if (text.includes('\n')) {
                this.stats.wrap.push(text);
            }

            this.stats.rune.push(text, element.id);
        })
        //聖域
        result[result.findIndex((e: any) => e.id === "sanctum")].entries.forEach((element: any, index: any) => {
            let text = element.text;
            let count = (text.match(/\|/g) || []).length;
            //處理說明字串
            if (count > 0) {
                text = this.replaceIllustrate(text, count);
            }

            this.stats.sanctum.push(text, element.id);
        })
        //技能詞綴
        result[result.findIndex((e: any) => e.id === "skill")].entries.forEach((element: any, index: any) => {
            let text = element.text;
            //處理折行詞綴
            if (text.includes('\n')) {
                this.stats.wrap.push(text);
            }

            this.stats.skill.push(text, element.id);
        })
        //褻瀆詞綴
        result[result.findIndex((e: any) => e.id === "desecrated")].entries.forEach((element: any, index: any) => {
            let text = element.text;
            //處理折行詞綴
            if (text.includes('\n')) {
                this.stats.wrap.push(text);
            }

            this.stats.desecrated.push(text, element.id);
        })
        //破裂詞綴
        result[result.findIndex((e: any) => e.id === "fractured")].entries.forEach((element: any, index: any) => {
            let text = element.text;
            //處理折行詞綴
            if (text.includes('\n')) {
                this.stats.wrap.push(text);
            }

            this.stats.fractured.push(text, element.id);
        })

        //清除資料
        this.datas.stats = [];
    }

    //取代說明字樣
    replaceIllustrate(text: any, count: any) {
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
}