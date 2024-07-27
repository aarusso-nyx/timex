// stay.service.ts

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, Subject } from 'rxjs';
import { map, tap } from 'rxjs/operators';

// import { environment } from '../environments/environment';
import { Stay } from '../models/stay';
import { sampleStays } from './stays.sample';

const baseURL = 'http://localhost:3000';


@Injectable({
  providedIn: 'root',
})
export class StayService {
  
  private stays: Stay[] = [];
  private stash: Stay[] = [];
  private stash$: BehaviorSubject<Stay[]> = new BehaviorSubject(this.stash);
  private update(): void {
    this.stash$.next(this.stash);
  }

  constructor(private http: HttpClient) {
    this.loadStays().subscribe(
      stays => {
        this.stays = stays;
        this.reset();
      });
  }


  // Load data from the mock file or API endpoint into the working buffer
  private loadStays(from?: Date, to?: Date): Observable<Stay[]> {
    const parse = (stay: any): Stay => {
      const { etb, etd, atb, atd } = stay.schedule;
      stay.schedule.etb = new Date(etb);
      stay.schedule.etd = new Date(etd);
      if (atb) stay.schedule.atb = atb ? new Date(atb) : null;
      if (atd) stay.schedule.atd = atd ? new Date(atd) : null;
      stay.changed = false;

      return stay;
    }
    
    return of(sampleStays).pipe(map(stays => stays.map(parse)));
  }

  public fetch(): Observable<Stay[]> {
    return this.stash$.asObservable();
  }

  public reload(): void {
    this.loadStays().subscribe(
      stays => {
        this.stays = stays;
        this.reset();
      });
  }

  // Discard all changes in the buffer
  public reset(): void {
    this.stash = this.stays;
    this.update();
  }  

  // Commit changes to the data source (mock or actual API)
  public commit(): Observable<any> {
    const feaseable = (stash: Stay[]): boolean => {
      const conflict = (stay1: Stay, stay2: Stay): boolean => {
        const { etb: etb1, etd: etd1 } = stay1.schedule;
        const { etb: etb2, etd: etd2 } = stay2.schedule;
        const stern1 = stay1.docking.pos;
        const bow1 = stern1 + stay1.vessel.len;
        const stern2 = stay2.docking.pos;
        const bow2 = stern2 + stay2.vessel.len;
    
        const timeOverlap = etb1 <= etd2 && etd1 >= etb2;
        const positionOverlap = stern1 <= bow2 && bow1 >= stern2;
    
        return timeOverlap && positionOverlap;
      }

      for (let i=0; i<stash.length; i++) {
        for (let j=i+1; j<stash.length; j++) {
          if (conflict(stash[i], stash[j])) {
            return true;
          }
        }
      }

      return false;
    }
  
    if ( feaseable(this.stash) ) {
      return this.http.post(`${baseURL}/stays`, this.stash)
          .pipe(tap(() => this.reload()));
    } else {
      return of('Error: Hard Overlap Detected');
    }
  }

  // Add a new stay to the buffer
  public create(stay: Stay): void {
    this.stash.push({ ...stay, status: 'new' });
    this.update();
  }

  // Update an existing stay in the buffer
  public change(stay: Stay): void {
    const index = this.stash.findIndex(s => s === stay);
    if (index >= 0) {
      this.stash[index] = { ...stay, status: 'changed' };
      this.update();
    }
  }

  // Remove a stay from the buffer by vessel ID
  public remove(stay: Stay): void {
    const index = this.stash.findIndex(s => s === stay);
    if (index >= 0) {
      this.stash[index] = { ...stay, status: 'deleted' };
      this.update();
    }
  }
}