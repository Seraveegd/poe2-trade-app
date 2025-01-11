import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    CommonModule
  ],
  providers: [],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})

export class AppComponent implements OnInit {

  public colorScheme = 'dark';

  constructor() { }

  ngOnInit(): void {
    const localStorageColorScheme = localStorage.getItem('prefers-color');
    // Check if any prefers-color-scheme is stored in localStorage
    if (localStorageColorScheme) {
      this.colorScheme = localStorageColorScheme;
      // Save prefers-color-scheme from localStorage
      (<any>window).ipcRenderer.send('toggle-theme', localStorageColorScheme);
    }

    (<any>window).ipcRenderer.on('visibility-change', (e: any, state: any) => {
      if (document.body.style.display) {
        document.body.style.display = '';
      } else {
        document.body.style.display = 'none';
      }
    });

    (<any>window).ipcRenderer.on('focus-change', (e: any, state: any) => {
      console.log('focus-change', state);
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
}
