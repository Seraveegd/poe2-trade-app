import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { CopyTextService } from './copy-text.service';

// import { clipboard } from 'electron';

// const { clipboard } = require('electron');

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink
  ],
  providers: [
    CopyTextService
  ],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})

export class AppComponent implements OnInit {

  copyText: string = '';

  constructor(private CopyTextService: CopyTextService) {    
    // this.getCopyText();
    this.CopyTextService.copyText$.subscribe((data) => {
      console.log(data);
    });

    // window.addEventListener('keyup', (e) => {
    //   console.log(`You pressed ${e.key}`);
    // }, true);
  }

  ngOnInit(): void {
    // this.ipc.send("openModal");
    // setInterval(() => {
    //   const copyText = localStorage.getItem('copyText');
    //   if (this.copyText != copyText) {
    //     this.copyText = copyText!;
    //     this.change(copyText);
    //   }
    // }, 500);
    // if (localStorage.getItem('copyText')!.indexOf('稀有度:') > -1) {
    //   this.cleanClipboard();
    // }
    // this.initLocalStorage();
    // this.app.isTwServer = this.app.storeServerString === '台服' ? true : false;
    // this.app.baseUrl = this.app.isTwServer ? 'https://pathofexile.tw' : 'https://www.pathofexile.com';
    // this.app.poedbTWItems = this.app.poedbTWJson.data.filter((item: any) => item.type !== "Class");
  }

  // constructor(private app: App){

  // }

  initLocalStorage() {
    // this.app.isPriceCollapse = localStorage.getItem('isPriceCollapse') ? JSON.parse(localStorage.getItem('isPriceCollapse') ?? '') : true;
    // if (this.app.isPriceCollapse) {
    //   this.app.searchJson_Def.query.filters.trade_filters.filters.collapse = {
    //     option: "true"
    //   }
    // } else {
    //   delete this.app.searchJson_Def.query.filters.trade_filters.filters.collapse
    // }
  }

  getCopyText() {
    // const str: string = localStorage.getItem('copyText') ?? '';
    // this.CopyTextService.changeObject(Math.random());
    this.CopyTextService.copyText$.subscribe((data) => {
      console.log(data);
    });
  }

  change(input: any): void {
    this.CopyTextService.changeObject(input);
  }

  cleanClipboard() {
    localStorage.setItem('copyText', '');
  }

  cleanCopyText() {
    this.copyText = '';
  }
}
