import * as d3 from 'd3';

import { Vessel, Stay, ScaleLinear, ScaleTime } from '../../models/stay';

//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
export const snap = (n: number, m: number): number => Math.round(n/m)*m;

//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
export const translationOf = (el: Element): [number, number] => {
    const d = d3.select(el)
                .attr('transform')
                .match(/translate\(([^)]+)\)/);
  
    return d ? (d[1].split(',').map(Number) as [number, number]) : [0, 0];
}

//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
export const labelOf = (d: Stay): string => {
    const pos = d.docking.pos;
    const { etb, etd } = d.schedule;
    const fmt = (d: Date) => d3.timeFormat('%H:%M %d/%m')(d);
    const labels = [
        `${d.vessel.vessel_name} (${d.vessel.lpp}m) @ ${Math.round(pos)}m`,
        `ETB: ${fmt(etb)} - ETD: ${fmt(etd)}`
    ];

    return labels.join('\n');
}

//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
export const makeHull = (v: Vessel, d: number=1): string => {
    const l = 2*v.lpp;
    const b = 2*v.beam;
  
    return (d === 1)? `M 0,0 V ${b} H ${0.8*l} L ${l},${b/2} L ${0.8*l},0 Z`
                    : `M ${l},0 V ${b} H ${0.2*l} L 0,${b/2} L ${0.2*l},0 Z`;
}

//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
export const clickable = (event: PointerEvent) => { 
    const elem = event.target as Element;
    const e = d3.select(elem.parentElement);
    e.classed('selected', !e.classed('selected'));
}

//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
export const draggable = () => {
    let dx: number, dy: number;

    return d3.drag()
        .on('start', function(this: Element, event: any): void {
            d3.select(this).classed('dragging', true);
            [dx, dy] = translationOf(this);
        })
        .on('drag', function(this: Element, event: any): void {
            dx += event.dx;
            dy += event.dy;

            const grab = d3.select(this);

            if ( grab.classed('ship') ) {
                grab.attr('transform', `translate(${dx},${0})`);
            } else {
                grab.attr('transform', `translate(${dx},${dy})`);
            }
            
            update(mirror(grab, dx))  
        })
        .on('end', function(this: Element): void {
            d3.select(this).classed('dragging', false);
        });
}

//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
export const stretchable = () => {
    let dy: number, h0: number;

    const boxOf = (el: any): any => d3.select(el.node().parentNode).select('rect');
    const parent = (el: any): any => d3.select(el.node().parentNode);

    return d3.drag()
        .on('start', function(this: Element, event: any): void {
            const dot = d3.select(this).classed('sizing', true).classed('touched', true);
            const box = boxOf(dot);
          
            dy = +box.attr('y');
            h0 = +box.attr('height');
        })
        .on('drag', function(this: Element, event: any): void {
            const dot = d3.select(this);
            const box = boxOf(dot);

            dy += event.dy;

            dot.attr('cy', dy);
            box.attr('y', dy);
            box.attr('height', Math.max(h0-dy,0));

            update(parent(box));
        })
        .on('end', function(this: Element): void {
            d3.select(this).classed('sizing', false);
        });
} 

//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
export const timeslider = (that: any, yScale: ScaleTime) => {
    return d3.drag()
        .on('drag', function(this: Element, event: any): void {
            d3.select(this)
                .attr('y1', event.y)
                .attr('y2', event.y);

        that.now = yScale.invert(event.y);
    });
}

//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
const mirror = (el: any, x: number ): any => {
    el.classed('touched', true);

    const [ item, id ] = el.attr('id').split('-');
    const _id = (item === 'ship') ? `stay-${id}` : `ship-${id}`;
    const twin = d3.select(`#${_id}`);
    
    if ( twin.empty() ) return;

    const tr = translationOf(twin.node() as Element);
    twin.attr('transform', `translate(${x},${tr[1]})`)
        .classed('touched', true);

    return (item === 'ship') ? twin : el;
}

//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
const update = (elem: any): void => {
    const overlaps = (a: any, b: any): boolean => {
        const [ax, ay] = translationOf(a);
        const [bx, by] = translationOf(b);
        
        const aw = +d3.select(a).select('rect').attr('width');
        const ah = +d3.select(a).select('rect').attr('height');
        const bw = +d3.select(b).select('rect').attr('width');
        const bh = +d3.select(b).select('rect').attr('height');
        
        return (ax < bx + bw && ax + aw > bx &&
                ay < by + bh && ay + ah > by);
    }

    const d = elem.datum() as Stay;
    // elem.classed('touched', true);
    // elem.datum(d);
    
    const id = elem.attr('id').split('-')[1];
    const twin = d3.select(`#ship-${id}`);
    
    let overlap = false;
    d3.selectAll('g.stay')
        .filter(function(this) {
            return this !== elem.node();
        })
        .each(function(this) {
            const o = overlaps(this, elem.node());
            overlap ||= o;

            d3.select(this).classed('overlap', o);
        });

    // const yNow = +d3.select('line.cursor').attr('y1');
    // const y = translationOf(elem.node())[1];
    // const h = +elem.select('rect').attr('height');
    // console.log(yNow, y, h);

    elem.classed('overlap', overlap)
        // .classed('current', (y <= yNow && yNow <= y+h))
        .classed('touched', true)
        // .selectAll('text')
        // .data(labelOf(d).split('\n'))
        // .text((d: string) => d);

    twin.classed('overlap', overlap)
        .classed('touched', true);
}


  //////////////////////////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////
//   const process = (el: any, dx: number, dy: number, xScale: ScaleLinear, yScale: ScaleTime ): void => {
      

//     const d = el.datum();
//     const w = +el.select('rect').attr('width');
    
//     d.schedule.etb = new Date(xScale.invert(dx));
//     d.schedule.etd = new Date(xScale.invert(dx+w));
//     d.docking.pos = yScale.invert(dy);
//     d.changed = true;
//     el.datum(d);

//     let overlap = false;
//     // this.plot
    
//     // const fleet 
    
//     d3
//         .selectAll('g.stay')
//         // .filter(function(e: Element) {
//         //   return e !== el.node();
//         // })
//         // .each(function(e: Element) {
//         //   const o = overlaps(e, el.node());
//         //   overlap ||= o;

//         //   d3.select(e)
//         //     .classed('overlap', o);
//         // });
//   }
  