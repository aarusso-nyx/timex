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
  private stays$ =  this.stays.fetch();
  // private slctd: Stay | null = null;

  private margin = { top: 20, right: 20, bottom: 40, left: 80 };
  private clipPathId = 'clip-path';

  private gx: number = 1; // grid x
  private gy: number = 1;
  private svg: any;
  private root: any;
  private xZoom: any;
  private yZoom: any;
  private xAxis: any;
  private yAxis: any;
  private xGrid: any;
  private yGrid: any;
  private xScale: any;
  private yScale: any;

  constructor(public stays: StayService) {}

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  ngOnInit(): void {
    let bFirst = true;
    this.stays$.subscribe(stays => {
      if ( bFirst ) {
        this.init(stays);
        bFirst = false;
      }

      this.redraw(stays);
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
          .attr('id', this.clipPathId)
          .append('rect')
            .attr('width', width)
            .attr('height', height);
  
    this.svg = svg
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    this.root = this.svg
      .append('g')
      .attr('class', 'stays')
      .attr('clip-path', `url(#${this.clipPathId})`);

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
    this.xAxis = this.svg.append('g')
      .attr('class', 'x axis')
      .attr('transform', `translate(0,${height})`)
      
    this.xGrid = this.svg.append('g')
      .attr('class', 'x grid')
      .attr('transform', `translate(0,${height})`)

    this.yAxis = this.svg.append('g')
      .attr('class', 'y axis')

    this.yGrid = this.svg.append('g')
      .attr('class', 'y grid')

    const rescaleXAxis = (xScale: any) => {
      this.gx = xScale(0) - xScale(0 + 6*60*60*1000); // 6 hours in milliseconds

      this.xAxis.call(d3.axisBottom(xScale).ticks(20));
      this.xGrid.call(d3.axisBottom(xScale).ticks(d3.timeHour.every(6))
      .tickSize(-height)
      .tickFormat(() => ''));
    }

    const rescaleYAxis = (yScale: any) => {
      this.gy = yScale(0) - yScale(0 + 10); // 10 meters

      this.yAxis.call(d3.axisLeft(yScale).ticks(20));
      this.yGrid.call(d3.axisLeft(yScale)
        .ticks(10)
        .tickSize(-width)
        .tickFormat(() => ''));
    }

    rescaleYAxis(this.yScale); 
    rescaleXAxis(this.xScale);


    // Define zoom behavior
    this.xZoom = d3.zoom()
        .scaleExtent([0.5, 5])
        .translateExtent([[0, 0], [width, height]])
        .on('zoom', (event) => {
            const newXScale = event.transform.rescaleX(this.xScale);
            rescaleXAxis(newXScale);
            this.root.selectAll('rect,text')
                .attr('x', (d:any) => newXScale(d.schedule.etb))
                .attr('width', (d:any) => newXScale(d.schedule.etd) - newXScale(d.schedule.etb));

            this.root.selectAll('circle.etd')
                .attr('cx', (d:any) => newXScale(d.schedule.etd));

        });

    this.yZoom = d3.zoom()
        .scaleExtent([1, 10])
        .translateExtent([[0, 0], [width, height]])
        .on('zoom', (event) => {
            const newYScale = event.transform.rescaleY(this.yScale);
            rescaleYAxis(newYScale);
            this.root.selectAll('rect,text')
                .attr('y', (d:Stay) => newYScale(d.docking.pos))
                .attr('height', (d:Stay) => newYScale(0) - newYScale(d.vessel.len));

            this.root.selectAll('circle.etd')
                .attr('cy', (d:Stay) => newYScale(d.docking.pos) + (newYScale(0) - newYScale(d.vessel.len))/2);
        });

    svg.call(this.xZoom);

    d3.select(window)
      .on('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Shift') {
          svg.call(this.yZoom);
        }

        if (event.key === 'Delete' || event.key === 'Backspace') {
          this.root.selectAll('.selected').classed('selected', false).remove();
        }
      })
      .on('keyup', (event: KeyboardEvent) => {
        if (event.key === 'Shift') {
          svg.call(this.xZoom);
        }
      });
  }

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  private redraw(stays: Stay[]): void {
    const snap = (n: number, m: number): number => Math.round(n/m)*m;

    let dx: number, dy: number;
    let cx: number, cy: number;

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
      .on('click', function(this: Element) { 
        const el = d3.select(this);
        el.classed('selected', !el.classed('selected'));
       })
      .call(d3.drag()
        .on('start', function(this: Element, event: any): void {
            const dad = d3.select(this);
            const box = dad.select('rect');
            const dot = dad.select('circle');
            
            dad.classed('dragging', true)
                .classed('touched', true)

            dx = event.x - +box.attr('x');
            dy = event.y - +box.attr('y');
            cx = event.x - +dot.attr('cx');
            cy = event.y - +dot.attr('cy');
        })
        .on('drag', function(this: Element, event: any): void {
            const x = snap(event.x - dx, that.gx);
            const y = snap(event.y - dy, that.gy);

            d3.select(this).selectAll('rect,text')
              .attr('x', x)
              .attr('y', y);

            d3.select(this).select('circle')
              .attr('cx', x - cx + dx)
              .attr('cy', y - cy + dy);
        })
        .on('end', function(this: Element): void {
            d3.select(this).classed('dragging', false);
        })
      );


    items
      .append('rect')
        .attr('x', (d:Stay) => this.xScale(d.schedule.etb))
        .attr('y', (d:Stay) => this.yScale(d.docking.pos))
        .attr('width', (d:Stay) => this.xScale(d.schedule.etd) - this.xScale(d.schedule.etb))
        .attr('height', (d:Stay) => this.yScale(0) - this.yScale(d.vessel.len))
        .attr('cursor', 'move');

    items
      .append('text')
        .attr('class', 'label')
        .attr('x', (d:Stay) => this.xScale(d.schedule.etb))
        .attr('y', (d:Stay) => this.yScale(d.docking.pos))
        .attr('dy', '1.2em')
        .attr('dx', '0.5em')
        .text((d:Stay) => d.vessel.vessel_name + ' (' + d.vessel.len + 'm)')
        .attr('cursor', 'click');

    items
      .append('circle')
        .attr('class', 'etd')
        .attr('cx', (d:Stay) => this.xScale(d.schedule.etd))
        .attr('cy', (d:Stay) => this.yScale(d.docking.pos) + (this.yScale(0) - this.yScale(d.vessel.len))/2)
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
  private getClass(d: Stay): string {
    return d.status || 'regular';
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
