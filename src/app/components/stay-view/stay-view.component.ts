import { StayService } from '../../services/stay.service';
import { Component, OnInit } from '@angular/core';
import { Stay } from '../../models/stay';
import * as d3 from 'd3';


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

  private qx: number = 1; // quantum x
  private qy: number = 1; // quantum y

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
      .attr('class', 'stays')
      .attr('clip-path', `url(#clip-path)`);

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

    rescaleYAxis(this.yScale); 
    rescaleXAxis(this.xScale);


    // Define zoom behavior
    const xZoom = d3.zoom()
        .scaleExtent([0.5, 5])
        .translateExtent([[0, 0], [width, height]])
        .on('zoom', (event) => {
            const newXScale = event.transform.rescaleX(this.xScale);
            rescaleXAxis(newXScale);
            // this.root.selectAll('rect,text')
            //     .attr('x', (d:any) => newXScale(d.schedule.etb))
            //     .attr('width', (d:any) => newXScale(d.schedule.etd) - newXScale(d.schedule.etb));

            // this.root.selectAll('circle.etd')
            //     .attr('cx', (d:any) => newXScale(d.schedule.etd));

        });

    const yZoom = d3.zoom()
        .scaleExtent([1, 10])
        .translateExtent([[0, 0], [width, height]])
        .on('zoom', (event) => {
            const newYScale = event.transform.rescaleY(this.yScale);
            rescaleYAxis(newYScale);
            // this.root.selectAll('rect,text')
            //     .attr('y', (d:Stay) => newYScale(d.docking.pos))
            //     .attr('height', (d:Stay) => newYScale(0) - newYScale(d.vessel.len));

            // this.root.selectAll('circle.etd')
            //     .attr('cy', (d:Stay) => newYScale(d.docking.pos) + (newYScale(0) - newYScale(d.vessel.len))/2);
        });

    svg.call(xZoom.bind(this));

    d3.select(window)
      .on('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Shift') {
          svg.call(yZoom.bind(this));
        }

        if (event.key === 'Delete' || event.key === 'Backspace') {
          this.root.selectAll('.selected').classed('selected', false).remove();
        }
      })
      .on('keyup', (event: KeyboardEvent) => {
        if (event.key === 'Shift') {
          svg.call(xZoom.bind(this));
        }
      });
  }

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  private redraw(stays: Stay[]): void {
    const snap = (n: number, m: number): number => Math.round(n/m)*m;

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
              .classed('touched', true)

            const delta = d3.select(this).attr('transform')
                            .match(/translate\(([^)]+)\)/);
            
            [dx, dy] = delta ? delta[1].split(',').map(Number) : [0, 0];
        })
        .on('drag', function(this: Element, event: any): void {
            dx += event.dx;
            dy += event.dy;
            d3.select(this).attr('transform', `translate(${snap(dx,that.gx)},${snap(dy,that.gy)})`);
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

    items.append('circle')
        .attr('class', 'etd')
        .attr('cx', (d:Stay) => this.xScale(d.schedule.etd) - this.xScale(d.schedule.etb))
        .attr('cy', (d:Stay) => (this.yScale(0) - this.yScale(d.vessel.len))/2)
        .attr('r', 15)
        .attr('cursor', 'ew-resize')
        .call(d3.drag()
        .on('start', function(this: Element, event: any): void {
            const dot = d3.select(this);
            dot.classed('sizing', true);
            cx = event.x - +dot.attr('cx');
        })
        .on('drag', function(this: Element, event: any): void {
            const dot = d3.select(this);
            const dad = (dot.node()?.parentNode)!;
            const box = d3.select(dad as Element).select('rect');

            const dw = +box.attr('width') - +dot.attr('cx');

            d3.select(dad as Element).classed('touched', true);
            box.attr('width', snap(event.x - cx, that.gx) + dw);
            dot.attr('cx', snap(event.x - cx, that.gx));
        })
        .on('end', function(this: Element): void {
            d3.select(this).classed('sizing', false);
        })
      );
  }

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  private validPosition(el: Element, x: number, y: number): boolean {
    const rect = d3.select(el).select('rect');
    const w = +rect.attr('width');
    const h = +rect.attr('height');

    const x1 = x;
    const x2 = x + w;
    const y1 = y;
    const y2 = y + h;

    const items = this.root.selectAll('g.stay').nodes();
    for (let i = 0; i < items.length; i++) {
      const item = d3.select(items[i]);
      if ( item.node() === el ) continue;

      const box = item.select('rect');
      const bx1 = +box.attr('x');
      const bx2 = +box.attr('x') + +box.attr('width');
      const by1 = +box.attr('y');
      const by2 = +box.attr('y') + +box.attr('height');

      if ( x1 < bx2 && x2 > bx1 && y1 < by2 && y2 > by1 ) {
        return false;
      }
    }

    return true
  }

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  private getClass(d: Stay): string {
    return d.status || 'regular';
  }

  private labelOf(d: Stay): string {
    const pos = d.docking.pos;
    const { etb, etd } = d.schedule;
    const fmt = (d: Date) => d3.timeFormat('%H:%M %d/%m')(d);
    const labels = [
      `${d.vessel.vessel_name} (${d.vessel.len}m) @ ${pos}m`,
      `ETB: ${fmt(etb)} - ETD: ${fmt(etd)}`
    ];
    
    return labels.join('\n');
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
