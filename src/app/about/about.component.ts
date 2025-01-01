import { Component } from '@angular/core';
import { NgbAccordionModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-about',
  imports: [NgbAccordionModule],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss'
})
export class AboutComponent {
  public hotkeys: any = [{
    "key": "F5",
    "description": "程式顯示在最上層，並且透明化 (可漂浮在POE程式上)"
  }, {
    "key": "F6",
    "description": "程式取消在最上層，並取消透明化"
  }, {
    "key": "PageUp",
    "description": "透明化程度 +5%"
  }, {
    "key": "PageDown",
    "description": "透明化程度 -5%"
  },]

  // BrowserWindow = require('electron');

  // createWindow() {
  //   const win = new this.BrowserWindow({
  //     width: 400,
  //     height: 400,
  //     backgroundColor: '#ffffff',
  //     icon: `dist/assets/logo.png`
  //   });
  //   win.loadFile(`dist/electron-app/browser/index.csr.html`);
  // }

  // ngOnInit() {
  //   this.createWindow();
  // }
}
