import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { NgbTooltipModule } from '@ng-bootstrap/ng-bootstrap';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    CommonModule,
    NgbTooltipModule
  ],
  providers: [],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})

export class AppComponent implements OnInit {

  public colorScheme = 'dark';
  public mode: any;

  constructor() { }

  ngOnInit(): void {
    (<any>window).ipcRenderer.on('reply-mode', (event: any, arg: any) => {
            this.mode = arg;
        });
    (<any>window).ipcRenderer.send('get-mode');

    const localStorageColorScheme = localStorage.getItem('prefers-color');
    // Check if any prefers-color-scheme is stored in localStorage
    if (localStorageColorScheme) {
      this.colorScheme = localStorageColorScheme;
      // Save prefers-color-scheme from localStorage
      (<any>window).ipcRenderer.send('toggle-theme', localStorageColorScheme);
    }

    (<any>window).ipcRenderer.on('visibility-change', (e: any, state: any) => {
      this.isDisplay(state);
    });
  }

  changeTheme() {
    if (this.colorScheme === 'dark') {
      this.colorScheme = 'light';
    } else {
      this.colorScheme = 'dark';
    }

    localStorage.setItem('prefers-color', this.colorScheme);

    (<any>window).ipcRenderer.send('toggle-theme', this.colorScheme);
  }

  isDisplay(state: any) {
    console.log(state, document.body.style.display);
    if (state === true) {
      document.body.style.display = 'block';
      // (<any>window).ipcRenderer.send('overlay');
    } else if (state === false) {
      document.body.style.display = 'none';
    } else if (state == 'blur') {
      (<any>window).ipcRenderer.send('blur');
    } else if (typeof state === 'undefined') {
      if (document.body.style.display === 'none') {
        console.log('+');
        document.body.style.display = 'block';
      } else {
        console.log('-');
        document.body.style.display = 'none';
      }
    }
  }
}
