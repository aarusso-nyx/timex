import { StayService } from '../../services/stay.service';
import { Component, OnInit } from '@angular/core';
import { Stay } from '../../models/stay';
import * as d3 from 'd3';

//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
const translationOf = (el: Element): [number, number] => {
  const d = d3.select(el)
              .attr('transform')
              .match(/translate\(([^)]+)\)/);

  return d ? (d[1].split(',').map(Number) as [number, number]) : [0, 0];
}

const snap = (n: number, m: number): number => Math.round(n/m)*m;

//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////

@Component({
  selector: 'app-stay-view',
  standalone: true,
  imports: [],
  templateUrl: './stay-view.component.html',
  styleUrl: './stay-view.component.scss'
})
export class StayViewComponent implements OnInit {
  private margin = { top: 20, right: 20, bottom: 40, left: 100 };

  private bollards = [ 0, 20, 40, 60, 80, 100, 125, 150, 175, 200, 225, 250, 275, 300, 325, 350, 375, 400,
    450, 500, 550, 600, 650, 700, 750, 800, 850, 900, 950, 1000
   ];

  private rh: number = 15;  // handle size
  
  private tx: number = 0; // translate x
  private ty: number = 0;
  
  private sx: number = 1; // scale x
  private sy: number = 1;

  private gx: number = 1; // grid x
  private gy: number = 1;

  private svg: any;
  private root: any;
  
  private xScale: any;
  private yScale: any;

  constructor(public stays: StayService) {}

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  ngOnInit(): void {
    let bFirst = true;
    this.stays.fetch().subscribe(stays => {
      if ( bFirst ) {
        this.init(stays);
        bFirst = false;
        this.redraw(stays);
      }
    });
  }

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  private init(stays: Stay[]): void {
    const svg = d3.select('svg');
    const width = +svg.attr('width') - this.margin.left - this.margin.right;
    const height = +svg.attr('height') - this.margin.top - this.margin.bottom;

    // Define clipPath to constrain drawing area
    svg.append('defs')
        .append('clipPath')
          .attr('id', 'clip-path')
          .append('rect')
            .attr('width', width)
            .attr('height', height);
  
    this.svg = svg
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    this.root = this.svg
      .append('g')
      .attr('class', 'plot')
      .attr('clip-path', `url(#clip-path)`)
        .append('g')
        .attr('class', 'stays')

	  // Define scales
    this.xScale = d3.scaleTime()
      .domain([
        d3.min( stays.map( d => new Date(d.schedule.etb) ) )!,
        d3.max( stays.map( d => new Date(d.schedule.etd) ) )!
      ])
      .range([ 0, width ]);

    this.yScale = d3.scaleLinear()
      .domain([ 0, 1000 ])
      .range([ height, 0 ]);

	  // Define axes
    const xAxis = this.svg.append('g')
      .attr('class', 'x axis')
      .attr('transform', `translate(0,${height})`)
      
    const xGrid = this.svg.append('g')
      .attr('class', 'x grid')
      .attr('transform', `translate(0,${height})`)

    const yAxis = this.svg.append('g')
      .attr('class', 'y axis')

    const yGrid = this.svg.append('g')
      .attr('class', 'y grid')

    const yBoll = this.svg.append('g')
      .attr('class', 'y bollard')
      .attr('transform', `translate(-66,0)`);

    const rescaleXAxis = (xScale: any) => {
      this.gx = xScale(0) - xScale(0 + 6*60*60*1000); // 6 hours in milliseconds

      xAxis.call(d3.axisBottom(xScale).ticks(20));
      xGrid.call(d3.axisBottom(xScale).ticks(d3.timeHour.every(6))
          .tickSize(-height)
          .tickFormat(() => ''));
    }

    const rescaleYAxis = (yScale: any) => {
      this.gy = yScale(0) - yScale(0 + 20); // 10 meters

      yBoll.call(d3.axisLeft(yScale)
          .tickValues(this.bollards)
          .tickSize(0)
          .tickPadding(10));

      yBoll.selectAll('.tick line').remove();
      yBoll.selectAll('.tick text').remove();

      // Add circles at the tick positions
      yBoll.selectAll('.tick')
        .append('circle')
        .attr('r', 5)
        .style('fill', 'black');

      yAxis.call(d3.axisLeft(yScale).ticks(20));
      yGrid.call(d3.axisLeft(yScale)
        .ticks(10)
        .tickSize(-width)
        .tickFormat(() => ''));
    }

    // Rescale axes
    rescaleYAxis(this.yScale); 
    rescaleXAxis(this.xScale);

    // Define zoom behavior
    const xZoom = d3.zoom()
        .scaleExtent([0.5, 5])
        .translateExtent([[0, 0], [width, height]])
        .on('zoom', (event) => {
            const t = event.transform;
            if ( event.sourceEvent?.shiftKey ) {
              this.sy = t.k;
              this.ty = t.y;
              rescaleYAxis(t.rescaleY(this.yScale));              
            } else {
              this.sx = t.k;
              this.tx = t.x;
              rescaleXAxis(t.rescaleX(this.xScale));
            }

            // Pan/Zoom Stay elements
            this.root.attr('transform', `translate(${this.tx},${this.ty}) scale(${this.sx},${this.sy})`);

            // Scale back labels            
            this.root.selectAll('.label').attr('transform', `scale(${1/this.sx},${1/this.sy})`);

            // Scale back handle
            this.root.selectAll('.etd').attr('rx', this.rh/this.sx);
            this.root.selectAll('.etd').attr('ry', this.rh/this.sy);

            // Scale back stroke width
            const w = 1.0 / Math.hypot(this.sx, this.sy);
            this.root.selectAll('rect').attr('stroke-width', w);
        });

    svg.call(xZoom.bind(this));

    d3.select(window)
      .on('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Delete' || event.key === 'Backspace') {
          this.root.selectAll('.selected').classed('selected', false).remove();
        }
      })
  }


  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  private redraw(stays: Stay[]): void {
    let dx: number, dy: number;
    let cx: number;

    const that = this;
    this.root
      .selectAll('g.stay')
      .remove();
    
    const items = this.root
      .selectAll('g.stay')
      .data(stays)
      .enter()
      .append('g')
      .attr('class', (d:Stay) => this.getClass(d))
      .classed('stay', true)
      .attr('id', (d:Stay) => `stay-${d.stay_id}`)
      .attr('transform', (d:Stay) => `translate(${this.xScale(d.schedule.etb)},${this.yScale(d.docking.pos)})`)
      .on('click', function(this: Element) { 
        const el = d3.select(this);
        el.classed('selected', !el.classed('selected'));
       })
      .call(d3.drag()
        .on('start', function(this: Element, event: any): void {
            d3.select(this)
              .classed('dragging', true)
              .classed('touched', true);

            [dx, dy] = translationOf(this);
        })
        .on('drag', function(this: Element, event: any): void {
            dx += event.dx;
            dy += event.dy;

            const x = snap(dx,that.gx);
            const y = snap(dy,that.gy);

            that.process( d3.select(this).attr('transform', `translate(${x},${y})`), x, y );      
       })
        .on('end', function(this: Element): void {
            d3.select(this).classed('dragging', false);
        })
      );

      
    items.append('rect')
        .attr('width', (d:Stay) => this.xScale(d.schedule.etd) - this.xScale(d.schedule.etb))
        .attr('height', (d:Stay) => this.yScale(0) - this.yScale(d.vessel.len))
        .attr('cursor', 'move');
      
    items.append('path')
        .attr('d', 'M 0.7,0.6 Q 0.5,0, 0.3,0.6 v .5 h 0.4 v -0.5 z')
        .attr('stroke', 'black')
        .attr('stroke-width', 0.1)
        .attr('fill', 'black')
        .attr('opacity', 0.5)
        .attr('transform', 'scale(30, 100)')
    
    items.append('g')
        .attr('class', 'label')
        .attr('cursor', 'click')
        .selectAll('text')
        .data((d:Stay) => this.labelOf(d).split('\n'))
        .enter()
        .append('text')
          .text((d: string) => d)
          .attr('dx', '0.5em')
          .attr('dy', (d: string, i: number) => `${1.5*i+1.3}em`);

    items.append('ellipse')
        .attr('class', 'etd')
        .attr('cx', (d:Stay) => this.xScale(d.schedule.etd) - this.xScale(d.schedule.etb))
        .attr('cy', (d:Stay) => (this.yScale(0) - this.yScale(d.vessel.len))/2)
        .attr('rx', this.rh)
        .attr('ry', this.rh)
        .attr('cursor', 'ew-resize')
        .call(d3.drag()
        .on('start', function(this: Element, event: any): void {
            const dot = d3.select(this);
            dot.classed('sizing', true);
            cx = event.x - +dot.attr('cx');
        })
        .on('drag', function(this: Element, event: any): void {
            const dot = d3.select(this);
            const dad = (dot.node()?.parentNode)! as Element;
            const box = d3.select(dad).select('rect');

            const dw = +box.attr('width') - +dot.attr('cx');
            const w0 = snap(event.x - cx, that.gx); 

            box.attr('width', w0+dw);
            dot.attr('cx', w0);

            that.process( d3.select(dad), dx, dy );  
        })
        .on('end', function(this: Element): void {
            d3.select(this).classed('sizing', false);
        })
      );
  }

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  private getClass(d: Stay): string {
    return d.status || 'regular';
  }

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  private labelOf(d: Stay): string {
    const pos = d.docking.pos;
    const { etb, etd } = d.schedule;
    const fmt = (d: Date) => d3.timeFormat('%H:%M %d/%m')(d);
    const labels = [
      `${d.vessel.vessel_name} (${d.vessel.len}m) @ ${Math.round(pos)}m`,
      `ETB: ${fmt(etb)} - ETD: ${fmt(etd)}`
    ];
    
    return labels.join('\n');
  }

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  private process(el: any, dx: number, dy: number ): void {
    const x = snap(dx,this.gx);
    const y = snap(dy,this.gy);
    const w = +el.select('rect').attr('width');
    const d = structuredClone(el.datum()) as Stay;
    
    d.schedule.etb = new Date(this.xScale.invert(x));
    d.schedule.etd = new Date(this.xScale.invert(x+w));
    d.docking.pos = this.yScale.invert(y);
    d.changed = true;
    


    const check = (a: any, b: any): boolean => {
      const [ax, ay] = translationOf(a);
      const [bx, by] = translationOf(b);
    
      const aw = +d3.select(a).select('rect').attr('width');
      const ah = +d3.select(a).select('rect').attr('height');
      const bw = +d3.select(b).select('rect').attr('width');
      const bh = +d3.select(b).select('rect').attr('height');
    
      return (ax < bx + bw && ax + aw > bx &&
              ay < by + bh && ay + ah > by);
    }
    

    let overlap = false;
    this.root.selectAll('g.stay')
    .filter(function(this: Element) {
      return this !== el.node();
    })
    .each(function(this: Element) {
      const o = check(this, el.node());
      overlap ||= o;

      d3.select(this)
        .classed('overlap', o);
    });

    el.classed('overlap', overlap)
      .classed('touched', true)
      .selectAll('text')
      .data(this.labelOf(d).split('\n'))
      .text((d: string) => d);
  }
  
  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  createNewStay(): void {
    // const now = Date.now();
    // const dt = 1000*60*60*24; // 1 day in milliseconds

    // const newStay: Stay = {
    //   stay_id: now,
    //   schedule: { etb: new Date(now-dt), etd: new Date(now+dt) },
    //   vessel: { vessel_name: 'New Vessel', vessel_id: Date.now(), len: 200 },
    //   docking: { dir: 1, pos: 800, aft: 0, rear: 0 }
    // };

    // this.stays.create(newStay);
    // this.slctd = newStay;
  }

  deleteStay(stay: Stay): void {
    // this.stays.remove(stay);
    // this.slctd = null;
  }
}
