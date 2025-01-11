import { Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { AboutComponent } from './about/about.component';

export const routes: Routes = [
    {
        path: 'home',
        component: HomeComponent,
        // children: [
        //     {
        //         path: 'analyze',
        //         component: AnalyzeComponent
        //     }
        // ]
    },
    {
        path: 'about',
        component: AboutComponent
    },
    {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
    },
    {
        path: '**',
        component: HomeComponent
    },
];
