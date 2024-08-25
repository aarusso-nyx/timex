import { Component, AfterViewInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';

import * as d3 from 'd3';

import { Stay } from '../../models/stay';
import { StayService } from '../../services/stay.service';
import { draggable, clickable, stretchable, 
          makeHull, labelOf, retense, deleted,
          translationOf,
          recheck} from './stay-view.functions';

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

  private sim: any;
  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  private xScale: any;
  private yScale: any;

  private plot: any;
  private pier: any;

  ////////////////////////////////////
  // timeline
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

    // Original scales
    const xScale = this.xScale; 
    const yScale = this.yScale;
  
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
    // draw horizontal line representing this.now;
    const that = this;
    this.plot
        .append('line')
        .attr('class', 'timeline')
        .attr('x1', 0)
        .attr('x2', width)
        .attr('y1', this.yScale(this._now))
        .attr('y2', this.yScale(this._now))
        .call(d3.drag()
                .on('drag', function(this: Element, event: any): void {
                    d3.select(this)
                        .attr('y1', event.y)
                        .attr('y2', event.y);

                    that.now = yScale.invert(event.y);
                }));

    //////////////////////////////////////////////////////////////////////
    //////////////////////////////////////////////////////////////////////
    // Rescale axes
    const rescaleYAxis = () => {
      yAxis[0].call(d3.axisLeft(this.yScale).ticks(12));
      yAxis[1].call(d3.axisLeft(this.yScale).ticks(d3.timeHour.every(6))
          .tickSize(-width)
          .tickFormat(() => ''));
    }

    const rescaleXAxis = () => {
      xAxis[0].call(d3.axisTop(this.xScale).ticks(20));
      xAxis[1].call(d3.axisBottom(this.xScale).ticks(20));

      this.pier.selectAll('.boll circle')
          .attr('cx', (d: number) => this.xScale(d));
    }

    // Scale axes
    rescaleYAxis(); 
    rescaleXAxis();

    // Define zoom behavior
    const xZoom = d3.zoom()
        .scaleExtent([1, 5])
        .translateExtent([[0, 0], [width, height]])
        .on('zoom', (event) => {
            const t = event.transform;
            if ( event.sourceEvent?.shiftKey ) {
              this.xScale = t.rescaleX(xScale);
              rescaleXAxis();
              this.drawPier();
            } else {
              this.yScale = t.rescaleY(yScale);
              rescaleYAxis();
              this.drawLine();  
            }
            
            this.drawPlot();           
        });

    svg.call(xZoom.bind(this));

    d3.select(window)
      .on('keydown', (event: KeyboardEvent) => {
        if (event.key === 'Delete' || event.key === 'Backspace') {
          deleted(this.plot);
          deleted(this.pier);
        }

        if (event.key === 'Enter') {
          this.calc();
        }

        if (event.key === 'Escape') {
          d3.selectAll('g.stay, g.ship')
            .classed('selected', false);
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
        .data(stays as Stay[])
        .enter()
          .append('g')
          .attr('class', 'stay')
          .attr('id', (d:Stay) => `stay-${d.stay_id}`)
          .on('click', clickable)
          .call(draggable(this.xScale, this.yScale));
          
    plot.append('rect')

    plot.append('circle')
        .attr('class', 'etd')
        .attr('r', 10)
        .call(stretchable(this.xScale, this.yScale));
      
    plot.append('g')
        .attr('class', 'label')
        .selectAll('text')
        .data((d:Stay) => labelOf(d).split('\n'))
        .enter()
        .append('text')
          .text((d: string) => d)
          .attr('dx', '0.5em')
          .attr('dy', (d: string, i: number) => `${1.5*i+1.25}em`);

    this.drawPlot();

    recheck();
  }

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  private drawPlot(): void {
    this.plot
        .selectAll('g.stay')
        .attr('transform', (d: Stay) => `translate(${this.xScale(d.docking.pos)},${this.yScale(d.schedule.etd)})`)
        .select('rect')
          .attr('width', (d: Stay) => this.xScale(d.vessel.lpp) - this.xScale(0))
          .attr('height', (d: Stay) => this.yScale(d.schedule.etb) - this.yScale(d.schedule.etd));

    this.plot
        .selectAll('g.stay circle.etd')
        .attr('cx', (d: Stay) => (this.xScale(d.vessel.lpp) - this.xScale(0))/2)
  }

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  private initPier(stays: Stay[], t: Date): void {
    const current = (v: Stay): boolean => {
      const { etb, etd } = v.schedule;
      return (etb <= t && t <= etd);
    }

    retense(this.plot.selectAll('.stay'), t);

    this.pier
        .selectAll('g.ship')
        .remove();

    const dock = this.pier
        .select('g.dock')
        .selectAll('g.ship')
        .data(stays.filter(current) as Stay[])
        .enter()
          .append('g')
          .attr('class', 'ship')
          .attr('id', (d:Stay) => `ship-${d.stay_id}`)
          .on('click', clickable)
          .call(draggable(this.xScale, this.yScale));

    dock.append('path')
        .attr('class', 'hull')
        .attr('d', (d: Stay) => makeHull(d.vessel, d.docking.dir));

    dock.append('text')
        .attr('class', 'label')
        .text((d: Stay) => d.vessel.vessel_name)
        .attr('dx', (d: Stay) => (0.5-0.1*d.docking.dir)*(this.xScale(d.vessel.lpp) - this.xScale(0) ))
        .attr('dy', (d: Stay) => 0.5*(this.xScale(d.vessel.beam) - this.xScale(0) ));

    this.drawPier();
  }

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  private drawPier(): void {
    this.pier.selectAll('.dock g.ship')
        .attr('transform', (d: Stay) => `translate(${this.xScale(d.docking.pos)},0)`);

    this.pier.selectAll('.dock rect')
        .attr('width', (d: Stay) => (this.xScale(d.vessel.lpp) - this.xScale(0) ) );
  }

  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  private drawLine(): void {
    this.plot.selectAll('.timeline')
        .attr('y1', this.yScale(this._now))
        .attr('y2', this.yScale(this._now));
  }
 
  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
  load(): void {
    console.log('load');
    alert('load');
  }

  drop(): void {
    console.log('drop');
    this.sim.stop();
  }

  save(): void {
    alert('save');
    this.plot.selectAll('.touched').classed('touched', false);
  }
  
  check(): void {
    recheck();
  }

  calc(): void {
    const W = this.xScale.range();
    const H = this.yScale.range().reverse();

    const stays = d3.selectAll('g.stay').data() as Stay[];
    
    this.sim = d3.forceSimulation(stays as any)
        // .force('x', d3.forceX( (d: any) => this.xScale(d.docking.pos)  ).strength(0.1))
        // .force('y', d3.forceY( (d: any) => this.yScale(d.schedule.etd) ).strength(0.5))
        .force('center', d3.forceCenter(W[1]/2, H[1]/2).strength(0.1))
        .force('charge', d3.forceManyBody().strength(10))
        .force('collide', d3.forceCollide(9)
      //   .radius(
      //     (d: any) => {
      //     const w = this.xScale(d.vessel.lpp) - this.xScale(0);
      //     const h = this.yScale(d.schedule.etb) - this.yScale(d.schedule.etd);
      //     return Math.hypot(w,h)/16;
      //   }
      // )
      .strength(10))
        // .force('boundary', (alpha: number) => {
        //   stays.forEach((d: any) => {
        //     const x = this.xScale(d.docking.pos);
        //     const y = this.yScale(d.schedule.etd);
        //     const w = this.xScale(d.vessel.lpp) - this.xScale(0);
        //     const h = this.yScale(d.schedule.etb) - this.yScale(d.schedule.etd);

        //     if ( x < W[0] ) d.x = W[0];
        //     if ( x + w > W[1] ) d.x = W[1] - w;

        //     if ( y < H[0] ) d.y = H[0];
        //     if ( y + h > H[1] ) d.y = H[1] - h;

        //   });
        // })
        .on('tick', () => {
          this.plot.selectAll('.stay')
              .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
        })
        .alpha(0.01)
        .restart();
  }
}