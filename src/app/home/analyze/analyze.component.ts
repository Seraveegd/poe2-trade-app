import { Component, EventEmitter, Input, OnChanges, OnInit, Output, SimpleChanges } from '@angular/core';
import { AppService } from '../../app.service';
import { forkJoin } from 'rxjs';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-analyze',
  imports: [NgbTooltipModule],
  templateUrl: './analyze.component.html',
  styleUrl: './analyze.component.scss',
})
export class AnalyzeComponent implements OnInit, OnChanges {
  @Output() isCounting = new EventEmitter<any>();
  @Input({ required: true }) searchResult: any = [];

  // public isLoading = false;
  public fetchResult: any = []; //回傳結果
  public computed: any = new Map(); //價格統計
  // public fetchIndex = 0; 
  public maxRead = 40; //每次讀取
  public itemImage = ''; //物品圖示
  public observ: any = []; //紀錄序列
  public corruptedCount: number = 0;

  public currencysList: any = new Map([
    ["transmute", {
      text: "蛻變石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lVcGdyYWRlVG9NYWdpYyIsInNjYWxlIjoxLCJyZWFsbSI6InBvZTIifV0/2f8e1ff9f8/CurrencyUpgradeToMagic.png"
    }],
    ["aug", {
      text: "增幅石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lBZGRNb2RUb01hZ2ljIiwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/c8ad0ddc84/CurrencyAddModToMagic.png"
    }],
    ["regal", {
      text: "富豪石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lVcGdyYWRlTWFnaWNUb1JhcmUiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/e8fb148e80/CurrencyUpgradeMagicToRare.png"
    }],
    ["annul", {
      text: "無效石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQW5udWxsT3JiIiwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/2daba8ccca/AnnullOrb.png"
    }],
    ["exalted", {
      text: "崇高石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lBZGRNb2RUb1JhcmUiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/ad7c366789/CurrencyAddModToRare.png"
    }],
    ["chaos", {
      text: "混沌石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lSZXJvbGxSYXJlIiwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/c0ca392a78/CurrencyRerollRare.png"
    }],
    ["vaal", {
      text: "瓦爾寶珠",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lWYWFsIiwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/72bc84396c/CurrencyVaal.png"
    }],
    ["alch", {
      text: "點金石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lVcGdyYWRlVG9SYXJlIiwic2NhbGUiOjEsInJlYWxtIjoicG9lMiJ9XQ/9b80b44821/CurrencyUpgradeToRare.png"
    }],
    ["divine", {
      text: "神聖石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lNb2RWYWx1ZXMiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/2986e220b3/CurrencyModValues.png"
    }],
    ["mirror", {
      text: "卡蘭德魔鏡",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lEdXBsaWNhdGUiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/26bc31680e/CurrencyDuplicate.png"
    }],
    ["chance", {
      text: "機會石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lVcGdyYWRlVG9VbmlxdWUiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/93c6cc8d5b/CurrencyUpgradeToUnique.png"
    }],
    ["artificers", {
      text: "工匠石",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lBZGRFcXVpcG1lbnRTb2NrZXQiLCJzY2FsZSI6MSwicmVhbG0iOiJwb2UyIn1d/5131fd4774/CurrencyAddEquipmentSocket.png"
    }],
    ["wisdom", {
      text: "知識卷軸",
      image: "https://webtw.poecdn.com/gen/image/WzI1LDE0LHsiZiI6IjJESXRlbXMvQ3VycmVuY3kvQ3VycmVuY3lJZGVudGlmaWNhdGlvbiIsInNjYWxlIjoxLCJyZWFsbSI6InBvZTIifV0/884f7bc58b/CurrencyIdentification.png"
    }]]);

  constructor(private poe_service: AppService) {
  }

  ngOnChanges(changes: SimpleChanges): void {
    console.log(changes);
  }

  ngOnInit(): void {
    this.analyze();
  }

  analyze() {
    console.log(this.searchResult);
    if (this.searchResult.searchTotal > 0) {
      this.fetchResult.length = 0;
      this.computed = new Map();
      // let vm = this;
      // this.isLoading = true;

      for (let i = 0; i < this.searchResult.fetchID.length && i < this.maxRead; i += 10) {
        // this.fetchIndex = i;
        const fetchIDs = this.searchResult.fetchID.slice(i, i + 10);

        this.observ.push(this.poe_service.get_trade_fetch(fetchIDs.join(','), this.searchResult.fetchQueryID));
      }

      this.fetchResultPrice();
      // 之後檢查
      // let newFilterResult = this.searchResult.fetchID.filter(function (item: any, index: any, array: any) {
      //   return indexLength > 4 ? index >= 4 && index < 8 && item : index < indexLength;
      // })
      // this.poe_service.get_trade_fetch(this.searchResult.fetchID, this.searchResult.fetchQueryID).subscribe((res: any) => {
      //   if (res) {
      //     this.fetchResult = this.fetchResult.concat(res.result);

      //     console.log(this.fetchResult);

      //     this.fetchResultPrice();

      //     this.isLoading = false;
      //     // this.$emit('scroll')
      //   }
      // });
    }
    // this.axios.all(newFilterResult.map((element: any, index: any) => {
    //   let params = {
    //     baseUrl: this.baseUrl,
    //     element,
    //     fetchQueryID: this.fetchQueryID
    //   }
    //   return this.axios.post(`http://localhost:3031/trade_fetch`, params)
    //   // return this.axios.get(`${this.baseUrl}/api/trade/fetch/${element}?query=${this.fetchQueryID}`)
    // }))
    //   .then(this.axios.spread((...res) => {
    //     let limitStringArray = []
    //     res.forEach((element, index) => {
    //       this.fetchResult[indexLength > 4 ? index + 4 : index].push(element.data.result)
    //       let limitString = (element.headers["x-rate-limit-ip-state"]).split(",")
    //       let limitState = limitString[1].substring(0, limitString[1].indexOf(':'))
    //       limitStringArray.push(parseInt(limitState, 10))
    //     });
    //     this.switchLimitState(Math.max(...limitStringArray))
    //     if (this.fetchResult[0].length !== 0 && !this.itemImage) {
    //       this.itemImage = this.fetchResult[0][0][0].item.icon
    //     }
    //     this.isLoading = false;
    //     this.$emit('scroll')
    //   }))
    //   .catch(function (error) {
    //     console.log(error)
    //     vm.isLoading = false;
    //     if (error.response.headers) {
    //       let limitString = (error.response.headers["x-rate-limit-ip-state"]).split(",")
    //       let limitState = limitString[1].slice(limitString[1].lastIndexOf(":") + 1)
    //       limitState = parseInt(limitState, 10)
    //       vm.$message({
    //         type: 'error',
    //         message: `被 Server 限制發送需求了，請等待 ${limitState} 秒後再重試`
    //       });
    //     }
    //   })
  }

  // switchLimitState(limitState: any) {
  //   // console.log('PriceAnalysis', limitState)
  //   switch (limitState) {
  //     case 12:
  //       this.$emit('countdown', 4 / 1.33)
  //       break;
  //     case 13:
  //     case 14:
  //     case 15:
  //     case 16:
  //       this.$emit('countdown', 6 / 1.33)
  //       break;
  //     default:
  //       break;
  //   }
  // }

  fetchResultPrice() {
    forkJoin([...this.observ]).subscribe((res: any) => {
      this.fetchResult = [].concat(...res.map((e: any) => { return e.result }));

      this.itemImage = this.fetchResult[0].item.icon;

      this.fetchResult.forEach((item: any) => {
        if (this.searchResult.extraFilterStr !== '' && item.item.explicitMods[0] !== this.searchResult.extraFilterStr) {
            return;
        }

        if (item.listing.price) {
          if (this.computed.has(item.listing.price.currency)) {
            if (!this.computed.get(item.listing.price.currency).has(item.listing.price.amount)) {
              this.computed.get(item.listing.price.currency).set(item.listing.price.amount, 1);
            } else {
              this.computed.get(item.listing.price.currency).set(item.listing.price.amount, this.computed.get(item.listing.price.currency).get(item.listing.price.amount) + 1);
            }
          } else {
            this.computed.set(item.listing.price.currency, new Map([
              [item.listing.price.amount, 1]
            ]));
          }
        }

        if (item.item.corrupted) {
          this.corruptedCount += 1;
        }
      });

      console.log(this.computed);
    }, (error: any) => {
      console.error(error.error.message);
    })
    // this.fetchResult.forEach((item: any) => {
    //   if (item.listing.price) {
    //     if (this.computed.has(item.listing.price.currency)) {
    //       if (!this.computed.get(item.listing.price.currency).has(item.listing.price.amount)) {
    //         this.computed.get(item.listing.price.currency).set(item.listing.price.amount, 1);
    //       } else {
    //         console.log(2);
    //         this.computed.get(item.listing.price.currency).set(item.listing.price.amount, this.computed.get(item.listing.price.currency).get(item.listing.price.amount) + 1);
    //       }
    //     } else {
    //       this.computed.set(item.listing.price.currency, new Map([
    //         [item.listing.price.amount, 1]
    //       ]));
    //     }
    //   }
    // });

    // return this.fetchResult.flat(Infinity).map((item: any) => {
    //   if (!item.gone) {
    //     return Object.values(item)[1];
    //   }

    //   return false;
    // }).filter(function (item: any, index: any, array: any) {
    //   return item; // 排除包含 "gone": true 的物品（物品不存在）
    // }).map((item: any) => {
    //   if (item.price) {
    //     item.price.accountName = new Array
    //     item.price.accountName[0] = item.account.name // 增加該帳號到陣列中
    //   }
    //   return item.price
    // }).filter(function (item: any, index: any, array: any) {
    //   return item; // 排除介面已選擇有標價但 API 還是回傳尚未標價的物品 （未標價 => null）
    // });

    this.isCounting.emit(false);
  }

  // fetchResultLength() {
  //   return Math.ceil(this.fetchResultPrice.length / 10)
  // }

  // calResultLength() { // 官方回傳的總數扣除目前搜尋且已整理的數量
  //   return this.resultLength - this.fetchResultPrice.length
  // }

  // collectionRepeat() {
  //   if (!this.isPriced || !this.fetchResultPrice[0]) {
  //     return 0
  //   }
  //   const result = [...this.fetchResultPrice.reduce((r, e) => { // 計算相同 amount & currency 重複的次數
  //     let k = `${e.amount}|${e.currency}`;
  //     if (!r.has(k)) {
  //       r.set(k, {
  //         ...e,
  //         count: 1
  //       })
  //     } else {
  //       r.get(k).count++
  //       if (r.get(k).accountName.indexOf(e.accountName[0]) === -1) {
  //         r.get(k).accountName.push(e.accountName[0]) // 每筆價格整理內皆包含不重複的使用者帳號名稱
  //       }
  //     }
  //     return r;
  //   }, new Map).values()]

  //   return result
  //   // return [...new Set(this.fetchResultPrice.map(item => JSON.stringify(item)))].map(item => JSON.parse(item)); // 去除相同 obj
  // }
}
