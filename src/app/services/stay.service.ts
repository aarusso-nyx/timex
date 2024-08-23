import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of, Subject } from 'rxjs';
import { map, tap } from 'rxjs/operators';

import { Stay } from '../models/stay';

const baseURL = 'http://localhost:3000';

const hours = 60*60*1000;
const days = 24*hours;

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
  private loadStays(n: number = 10): Observable<Stay[]> {

  const randomVessel = (id: number): Stay => {
      const pad = (n: number, p: number): number => Math.floor(n/p)*p;
      
      const randomDate = (from: Date, to: Date): Date => {
        const t = from.getTime() + Math.random() * (to.getTime() - from.getTime());
        return new Date(pad(t, 3*hours));
      }

      const now = Date.now();
      const dt = 3*days;

      const lpp = pad(Math.floor(100 + Math.random() * 200), 10);
      const beam = pad(Math.floor(10 + Math.random() * 40), 5);
      const stern = pad(Math.floor(Math.random() * 1000), 1);
      const dir = Math.random() > 0.5 ? 1 : -1;
      
      const etb = randomDate(new Date(now - dt), new Date(now + dt));
      const etd = randomDate(etb, new Date(now + dt));
      
      const schedule = { etb, etd };
      const docking = { dir, pos: stern, aft: 10, rear: 10 };
      const vessel = { vessel_id: id, vessel_name: `Vessel ${id}`, lpp, beam };
      
      const stay_id = Math.floor(Math.random() * 1000);

      return { stay_id, vessel, docking, schedule };
    } 

    return of([...Array(n).keys()].map(i => randomVessel(i+1)));
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
        const bow1 = stern1 + stay1.vessel.lpp;
        const stern2 = stay2.docking.pos;
        const bow2 = stern2 + stay2.vessel.lpp;
    
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
    this.stash.push(stay);
    this.update();
  }

  // Update an existing stay in the buffer
  public change(stay: Stay): void {
    const index = this.stash.findIndex(s => s === stay);
    if (index >= 0) {
      this.stash[index] = stay;
      this.update();
    }
  }

  // Remove a stay from the buffer by vessel ID
  public remove(stay: Stay): void {
    const index = this.stash.findIndex(s => s === stay);
    if (index >= 0) {
      this.stash[index] = stay;
      this.update();
    }
  }
}