import { Component } from '@angular/core';
import { NgbAccordionModule } from '@ng-bootstrap/ng-bootstrap';
import { Shell } from 'electron';

@Component({
  selector: 'app-about',
  imports: [NgbAccordionModule],
  templateUrl: './about.component.html',
  styleUrl: './about.component.scss'
})
export class AboutComponent {
  public shell!: Shell;

  constructor() {
    if ((<any>window).require) {
      try {
        this.shell = (<any>window).require('electron').shell;
      } catch (e) {
        throw e;
      }
    } else {
      console.warn('App not running inside Electron!');
    }
  }

  openGithubRelease(){
    this.shell.openExternal("https://github.com/Seraveegd/poe2-trade-app/releases");
  }
}
