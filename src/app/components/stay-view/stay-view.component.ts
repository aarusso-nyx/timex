import { Component, AfterViewInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';

import * as d3 from 'd3';

import { Stay, ScaleLinear, ScaleTime } from '../../models/stay';
import { StayService } from '../../services/stay.service';
import { makeHull, labelOf,
          draggable, clickable, stretchable, 
          timeslider } from './stay-view.functions';

//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////

@Component({
  selector: 'app-stay-view',
  standalone: true,
  imports: [CommonModule],
  providers: [ DatePipe ],
  templateUrl: './stay-view.component.html',
  styleUrl: './stay-view.component.scss'
})
export class StayViewComponent implements AfterViewInit {
  private margin = { top: 30, right: 30, bottom: 30, left: 90 };

  private readonly bollards: number[] = [ 
    20, 40, 60, 80, 100, 125, 150, 175, 200, 225, 
    250, 275, 300, 325, 350, 375, 400, 450, 500, 
    550, 600, 650, 700, 750, 800, 850, 900, 950
   ];

  
  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  private xScale: any;
  private yScale: any;

  private plot: any;
  private pier: any;

  ////////////////////////////////////
  // Cursor
  private _now: Date = new Date();
  public get now(): Date {
    return this._now;
  }

  private set now(t: Date) {
    this._now = t;
    this.initPier(this.stays, t);
  }

  ////////////////////////////////////
  // Stays
  private _stays: Stay[] = [];
  private get stays(): Stay[] {
      return this._stays;
  }

  private set stays(stays: Stay[]) {
      this._stays = stays;
      this.initPlot(stays);
      this.initPier(stays, this._now);
  }

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  constructor(public api: StayService) {}

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  ngAfterViewInit(): void {
    this.initDraw();

    this.api.fetch()
        .subscribe(stays => {
            this.stays = stays;
        });
  }


  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  private initDraw(): void {
    const svg = d3.select('#canvas');

    const bbox = (svg.node() as Element).getBoundingClientRect();
    const w = bbox.width;
    const h = bbox.height;

    svg.attr('viewBox', `0 0 ${w} ${h}`)
       .attr('preserveAspectRatio', 'xMidYMid meet');

    const width = w - this.margin.left - this.margin.right;
    const height = h - this.margin.top - this.margin.bottom;

    const m = 0.15; // margin pier 
    const k = 0.2;

    const yPier = 0;
    const hPier = k*height;
    const yPlot = hPier + this.margin.top;
    const hPlot = (1-k)*height - this.margin.top;

    //////////////////////////////////////////////////////////////////////
	  // Define scales
    this.yScale = d3.scaleTime()
        .domain([
          d3.timeDay.offset( new Date(), -4 ),
          d3.timeDay.offset( new Date(), +4 ),
        ])
        .range([ hPlot, 0 ]);

    this.xScale = d3.scaleLinear()
        .domain([ 0, 1000 ])
        .range([ 0, width ]);

    let xScale = this.xScale;
    let yScale = this.yScale;
  
    //////////////////////////////////////////////////////////////////////
    // Define clipPath to constrain drawing area
    const defs = svg.append('defs');

    defs.append('clipPath')
        .attr('id', 'clip-path-plot')
        .append('rect')
          .attr('width', width)
          .attr('height', hPlot);
  
    defs.append('clipPath')
        .attr('id', 'clip-path-pier')
        .append('rect')
          .attr('width', width)
          .attr('height', hPier);

    //////////////////////////////////////////////////////////////////////
    // Define root and pier, plot groups
    const root = svg
      .append('g')
      .attr('transform', `translate(${this.margin.left},${this.margin.top})`);

    this.plot = root
      .append('g')
      .attr('class', 'plot')
      .attr('transform', `translate(0,${yPlot})`)
      .attr('clip-path', `url(#clip-path-plot)`);

    this.pier = root
      .append('g')
      .attr('class', 'pier')
      .attr('transform', `translate(0,${yPier})`)
      .attr('clip-path', `url(#clip-path-pier)`);
    
    this.pier.append('rect')
        .attr('class', 'hollow')
        .attr('width', width)
        .attr('height', hPier);

    this.pier.append('g')
        .attr('class', 'dock')
        .attr('transform', `translate(0,${2*m*hPier})`);

    //////////////////////////////////////////////////////////////////////
    // Define axes
    const xAxis = [
      root.append('g')
          .attr('class', 'x axis')
          .attr('transform', `translate(0,${m*hPier})`),
      
      root.append('g')
          .attr('class', 'x axis')
          .attr('transform', `translate(0,${(1-m)*hPier})`)
    ];

    const yAxis = [
      root.append('g')
          .attr('class', 'y axis')
          .attr('transform', `translate(0,${yPlot})`),
  
      root.append('g')
          .attr('class', 'y grid')
          .attr('transform', `translate(0,${yPlot})`)
    ];

    //////////////////////////////////////////////////////////////////////
    // Draw bollards
    this.pier
        .append('g')
        .attr('class', 'boll')
        .attr('transform', `translate(0,${1.5*m*hPier})`)
        .selectAll('circle')
        .data(this.bollards)
        .enter()
        .append('circle')
          .attr('r', 5);

    //////////////////////////////////////////////////////////////////////
    // draw horizontal cursor representing this.now;
    this.plot
        .append('line')
        .attr('class', 'cursor')
        .attr('x1', 0)
        .attr('x2', width)
        .attr('y1', this.yScale(this._now))
        .attr('y2', this.yScale(this._now))
        .call(timeslider(this, yScale));


    //////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////
    // Rescale axes
    const rescaleYAxis = (yScale: any) => {
      yAxis[0].call(d3.axisLeft(yScale).ticks(12));
      yAxis[1].call(d3.axisLeft(yScale).ticks(d3.timeHour.every(6))
          .tickSize(-width)
          .tickFormat(() => ''));
    }

    const rescaleXAxis = (xScale: any) => {
      xAxis[0].call(d3.axisTop(xScale).ticks(20));
      xAxis[1].call(d3.axisBottom(xScale).ticks(20));

      this.pier.selectAll('.boll circle')
          .attr('cx', (d: number) => xScale(d));
    }

    // Scale axes
    rescaleYAxis(this.yScale); 
    rescaleXAxis(this.xScale);

    // Define zoom behavior
    const xZoom = d3.zoom()
        .scaleExtent([1, 5])
        .translateExtent([[0, 0], [width, height]])
        .on('zoom', (event) => {
            const t = event.transform;
            if ( event.sourceEvent?.shiftKey ) {
              xScale = t.rescaleX(this.xScale);
              rescaleXAxis(xScale);
              this.drawPier(xScale);
            } else {
              yScale = t.rescaleY(this.yScale);
              rescaleYAxis(yScale);
              this.drawLine(yScale);  
            }
            
            this.drawPlot(xScale, yScale);           
        });

    svg.call(xZoom.bind(this));

    d3.select(window)
      .on('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Delete' || event.key === 'Backspace') {
          this.plot.selectAll('.selected').classed('selected', false).remove();
        }
      });
  }

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  private initPlot(stays: Stay[]): void {
    this.plot
        .selectAll('g.stay')
        .remove();
    
    const plot = this.plot
        .selectAll('g.stay')
        .data(stays)
        .enter()
          .append('g')
          .classed('stay', true)
          .attr('id', (d:Stay) => `stay-${d.stay_id}`)
          .on('click', clickable)
          .call(draggable());

    plot.append('rect')
        .attr('cursor', 'move');

    plot.append('circle')
        .attr('class', 'etd')
        .attr('r', 10)
        .attr('cursor', 'ns-resize')
        .call(stretchable());
      
    plot.append('g')
        .attr('class', 'label')
        .attr('cursor', 'click')
        .selectAll('text')
        .data((d:Stay) => labelOf(d).split('\n'))
        .enter()
        .append('text')
          .text((d: string) => d)
          .attr('dx', '0.5em')
          .attr('dy', (d: string, i: number) => `${1.5*i+1.3}em`);
  
    this.drawPlot();
  }

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  private drawPlot(xScale: ScaleLinear = this.xScale, yScale: ScaleTime = this.yScale): void {
    // Update the transform and size for each stay
    this.plot.selectAll('g.stay')
        .attr('transform', (d: Stay) => `translate(${xScale(d.docking.pos)},${yScale(d.schedule.etd)})`)
        .select('rect')
        .attr('width', (d: Stay) => xScale(d.vessel.lpp) - xScale(0))
        .attr('height', (d: Stay) => yScale(d.schedule.etb) - yScale(d.schedule.etd));

    // Update the position of the ellipse
    this.plot.selectAll('g.stay circle.etd')
        .attr('cx', (d: Stay) => (xScale(d.vessel.lpp) - xScale(0))/2)
  }

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  private initPier(stays: Stay[], t: Date): void {
    const current = (v: Stay): boolean => {
      const { etb, etd } = v.schedule;
      return (etb <= t && t <= etd);
    }

    this.pier
        .selectAll('g.ship')
        .remove();

    this.plot.selectAll('.stay')
        .classed('current', (d: Stay) => current(d));

    const dock = this.pier
        .select('g.dock')
        .selectAll('g.ship')
        .data(stays.filter(current))
        .enter()
          .append('g')
          .attr('class', 'ship')
          .attr('id', (d:Stay) => `ship-${d.stay_id}`)
          .on('click', clickable)
          .call(draggable());

    dock.append('path')
        .attr('class', 'hull')
        .attr('d', (d: Stay) => makeHull(d.vessel, d.docking.dir))
        .attr('cursor', 'move');

    dock.append('text')
        .attr('class', 'label')
        .text((d: Stay) => d.vessel.vessel_name)
        .attr('dx', '1.75em')
        .attr('dy', '1.0em')
        .attr('fill', 'black');

    this.drawPier();
  }

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  private drawPier(xScale: ScaleLinear = this.xScale): void {
    this.pier.selectAll('.dock g.ship')
        .attr('transform', (d: Stay) => `translate(${xScale(d.docking.pos)},0)`);

    this.pier.selectAll('.dock rect')
        .attr('width', (d: Stay) => (xScale(d.vessel.lpp) - xScale(0) ) );
  }

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  private drawLine(yScale: ScaleTime): void {
    this.plot.selectAll('.cursor')
        .attr('y1', yScale(this._now))
        .attr('y2', yScale(this._now));
  }
 
  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  load(): void {
    console.log('load');
  }

  drop(): void {
    console.log('drop');
  }

  calc(): void {
    console.log('calc');
  }

  save(): void {
    console.log('save');
  }
}
