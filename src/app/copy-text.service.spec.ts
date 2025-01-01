import { TestBed } from '@angular/core/testing';

import { CopyTextService } from './copy-text.service';

describe('CopyTextService', () => {
  let service: CopyTextService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CopyTextService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
