// stays.interfaces.ts
import * as d3 from 'd3';

export type ScaleLinear = d3.ScaleLinear<number, number>;
export type ScaleTime = d3.ScaleTime<number, number>;

////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////
export interface Schedule {
    etb: Date;            // Estimated Time of Boarding
    etd: Date;            // Estimated Time of Departure
    atb?: Date | null;    // Actual Time of Boarding (optional)
    atd?: Date | null;    // Actual Time of Departure (optional)
}
  
export interface Vessel {
    vessel_name: string;
    vessel_id:  number;
    lpp:        number;   // Length of the vessel in meters
    beam:       number;   // Beam of the vessel in meters
}
  
export interface Docking {
    dir:  number;         // Direction: +1 for bow in positive direction, -1 for bow in negative direction
    pos:  number;         // Position of the vessel's stern on the pier (0 to 1000m)
    aft:  number;         // Buffer size ahead of the bow to reserve
    rear: number;         // Buffer size before the stern
}
  
export interface Stay {
    stay_id?: number;     // Unique identifier for the stay

    vessel:   Vessel;     // Information about the vessel - Unchangable
    docking:  Docking;    // Docking information
    schedule: Schedule;   // The scheduled and actual times
}
