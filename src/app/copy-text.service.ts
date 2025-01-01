import { Injectable } from '@angular/core';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class CopyTextService {
  private detectChanges: Subject<any> = new Subject<any>();
  copyText$ = this.detectChanges.asObservable();

  constructor() {
    this.detectChanges.subscribe((data) => {
      console.log("changed", data);
    });
  }

  changeObject(copyText: any) {
    this.detectChanges.next(copyText);
  }
}
