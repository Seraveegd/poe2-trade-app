import { Component, OnInit } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink
  ],
  providers: [],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss'
})

export class AppComponent implements OnInit {

  private colorScheme = 'dark';

  constructor() { }

  ngOnInit(): void {
    const localStorageColorScheme = localStorage.getItem('prefers-color');
    // Check if any prefers-color-scheme is stored in localStorage
    if (localStorageColorScheme) {
      // Save prefers-color-scheme from localStorage
      (<any>window).ipcRenderer.send('toggle-theme', localStorageColorScheme);
    }
  }

  changeTheme() {
    if (this.colorScheme === 'dark') {
      localStorage.setItem('prefers-color', 'light');
    } else {
      localStorage.setItem('prefers-color', 'dark');
    }

    (<any>window).ipcRenderer.send('toggle-theme');
  }
}
